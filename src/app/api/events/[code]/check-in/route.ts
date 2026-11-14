import { NextRequest } from "next/server";
import { withHandler, json, validateBody, checkIdempotency, logAudit } from "@/app/api/_lib/route-helper";
import { checkInSchema, eventCodeSchema } from "@/app/api/_lib/schemas";
import {
  getEventByCode,
  countAttendanceByEvent,
  countAttendanceByEventPhone,
  getAttendanceByIdempotencyKey,
  createAttendanceRecord,
  createVerificationLog,
  createAccessLog,
  createAuditLog,
} from "@/db/repository";
import { withTx } from "@/db/index";
import * as schema from "@/db/schema";
import { isValidCoordinate, isWithinGeofence, isGpsFresh } from "@/lib/gps";

const { attendanceRecords: schemaAttendances, attendanceVerificationLogs: schemaVerificationLogs, attendanceCustomFieldValues: schemaCFV } = schema;

const MAX_GPS_AGE_MS = 5 * 60 * 1000;

const handler = withHandler(
  async (req: NextRequest, { params }: any) => {
    const { code } = await params;
    eventCodeSchema.parse({ code });

    const body = await validateBody(req, checkInSchema);
    const {
      participant_name,
      participant_phone,
      participant_identifier,
      participant_organization,
      participant_category,
      latitude,
      longitude,
      accuracy,
      gps_timestamp,
      idempotency_key,
      custom_fields,
      user_agent,
    } = body;

    const event = await getEventByCode(code);
    if (!event) return json({ error: "Event not found" }, 404);

    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    await createAccessLog({ eventId: event.id, accessAttemptType: "CHECK_IN", result: "FAILURE", ipAddress: ip, userAgent: user_agent });

    const now = new Date();
    if (event.status !== "OPEN") {
      return json({ error: "Event is not open for check-in", status: event.status }, 409);
    }
    const checkinStart = new Date(event.checkinStartAt);
    const checkinEnd = new Date(event.checkinEndAt);
    if (now < checkinStart || now > checkinEnd) {
      return json({ error: "Check-in window is not currently open", stage: "checkin" }, 409);
    }

    if (event.maxAttendance) {
      const count = await countAttendanceByEvent(event.id);
      if (count >= event.maxAttendance) {
        return json({ error: "Event has reached maximum attendance" }, 409);
      }
    }

    if (!event.allowMultipleAttendance) {
      const existingCount = await countAttendanceByEventPhone(event.id, participant_phone);
      if (existingCount > 0) {
        return json({ error: "A check-in record already exists for this phone number", reference: null }, 409);
      }
    }

    if (idempotency_key) {
      const existing = await checkIdempotency(idempotency_key);
      if (existing) {
        await logAudit({ actorUserId: undefined, action: "ATTENDANCE_CHECK_IN_IDEMPOTENT_REPLAY", entityType: "AttendanceRecord", entityId: existing.id, newValues: { reference: existing.attendanceReference } });
        return json({ status: "replayed", attendance_reference: existing.attendanceReference, attendance_status: existing.attendanceStatus, checkin_at: existing.checkinAt });
      }
    }

    // GPS validation
    const gpsErrors: string[] = [];
    if (!isValidCoordinate(latitude, longitude)) gpsErrors.push("Invalid GPS coordinates");
    if (!isGpsFresh(gps_timestamp, MAX_GPS_AGE_MS)) gpsErrors.push("GPS reading is stale. Please capture a fresh location.");
    if (accuracy > event.gpsAccuracyThresholdMeters) {
      gpsErrors.push(`GPS accuracy (${accuracy.toFixed(1)} m) exceeds the required threshold (${event.gpsAccuracyThresholdMeters} m).`);
    }

    let geofenceWithin = false;
    let distanceMeters: number | null = null;
    let geofenceResult: "PASSED" | "FAILED" | "SKIPPED" = "SKIPPED";

    if (event.latitude != null && event.longitude != null) {
      if (isValidCoordinate(latitude, longitude)) {
        const { within, distanceMeters: d } = isWithinGeofence(latitude, longitude, event.latitude, event.longitude, event.geofenceRadiusMeters);
        geofenceWithin = within;
        distanceMeters = d;
        geofenceResult = event.requireGeofence ? (within ? "PASSED" : "FAILED") : "SKIPPED";
        if (event.requireGeofence && !within) {
          gpsErrors.push(`You are outside the permitted radius (${d.toFixed(0)} m from the event location).`);
        }
      }
    } else {
      geofenceResult = "SKIPPED";
    }

    const verificationStatus = gpsErrors.length === 0 ? "PASSED" : "FAILED";

    if (verificationStatus === "FAILED") {
      await createVerificationLog({ attendance_record_id: "00000000-0000-0000-0000-000000000000", stage: "CHECK_IN", latitude, longitude, accuracy, calculated_distance: distanceMeters, geofence_result: geofenceResult !== "FAILED", verification_result: verificationStatus, failure_reason: gpsErrors.join("; ") });
      return json({ error: "GPS verification failed", details: gpsErrors, verification: { status: "FAILED", geofence: geofenceResult, distanceMeters, accuracy } }, 400);
    }

    const reference = `ATT-${event.eventCode}-${Date.now().toString(36).toUpperCase()}`;

    const attendance = await withTx(async (tx) => {
      const [record] = await tx.insert(schemaAttendances).values({
        eventId: event.id,
        attendanceReference: reference,
        idempotencyKey: idempotency_key,
        participantName: participant_name,
        participantPhone: participant_phone,
        participantIdentifier: participant_identifier,
        participantOrganization: participant_organization,
        participantCategory: participant_category,
        checkinAt: now,
        checkinLatitude: latitude,
        checkinLongitude: longitude,
        checkinAccuracy: accuracy,
        checkinGpsTimestamp: new Date(gps_timestamp),
        checkinVerificationStatus: verificationStatus,
        attendanceStatus: "CHECKED_IN",
      }).returning();

      await tx.insert(schemaVerificationLogs).values({
        attendanceRecordId: record.id,
        stage: "CHECK_IN",
        latitude,
        longitude,
        accuracy,
        calculatedDistance: distanceMeters,
        geofenceResult: geofenceResult !== "FAILED",
        verificationResult: verificationStatus,
        failureReason: null,
      });

      if (custom_fields && typeof custom_fields === "object") {
        for (const [fieldId, value] of Object.entries(custom_fields)) {
          await tx.insert(schemaCFV).values({ attendanceRecordId: record.id, fieldId: fieldId, value: String(value) });
        }
      }

      return record;
    });

    await logAudit({ actorUserId: undefined, action: "ATTENDANCE_CHECK_IN", entityType: "AttendanceRecord", entityId: attendance.id, newValues: { reference: attendance.attendanceReference, phone: participant_phone } });

    return json({
      status: "checked_in",
      attendance_reference: attendance.attendanceReference,
      attendance_status: attendance.attendanceStatus,
      checkin_at: attendance.checkinAt,
      verification: { status: verificationStatus, geofence: geofenceResult, distanceMeters, accuracy },
      requires_checkout: true,
    });
  },
  { requireAuth: false }
);

export const POST = handler;
