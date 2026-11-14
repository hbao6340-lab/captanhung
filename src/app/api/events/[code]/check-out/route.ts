import { NextRequest } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { eventCodeSchema } from "@/app/api/_lib/schemas";
import {
  getEventByCode,
  createAccessLog,
  getAttendanceByReference,
  createVerificationLog,
  createAuditLog,
  updateAttendance,
  createAttendanceEvidence,
  getAttendanceByIdempotencyKey,
} from "@/db/repository";
import { withTx } from "@/db/index";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { isValidCoordinate, isWithinGeofence, isGpsFresh } from "@/lib/gps";
import { validateFile, readFileBuffer, storeFile } from "@/lib/storage";
import { z } from "zod";

const { attendanceRecords: schemaAttendances, attendanceVerificationLogs: schemaVerificationLogs, attendanceEvidence: schemaEvidence } = schema;

const MAX_GPS_AGE_MS = 5 * 60 * 1000;

const checkoutFormSchema = z.object({
  attendance_reference: z.string().min(1),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  accuracy: z.coerce.number().positive(),
  gps_timestamp: z.string().datetime(),
  idempotency_key: z.string().uuid().optional(),
});

const handler = withHandler(
  async (req: NextRequest, { params }: any) => {
    const { code } = await params;
    eventCodeSchema.parse({ code });

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Request must be multipart/form-data" }, 400);
    }

    const formData = await req.formData();
    const reference = formData.get("attendance_reference") as string;
    const latitude = Number(formData.get("latitude"));
    const longitude = Number(formData.get("longitude"));
    const accuracy = Number(formData.get("accuracy"));
    const gps_timestamp = formData.get("gps_timestamp") as string;
    const idempotency_key = (formData.get("idempotency_key") as string) || undefined;

    const parsed = checkoutFormSchema.parse({
      attendance_reference: reference,
      latitude,
      longitude,
      accuracy,
      gps_timestamp,
      idempotency_key,
    });

    const event = await getEventByCode(code);
    if (!event) return json({ error: "Event not found" }, 404);

    await createAccessLog({ eventId: event.id, accessAttemptType: "CHECK_OUT", result: "FAILURE", ipAddress: req.headers.get("x-forwarded-for") ?? undefined, userAgent: formData.get("user_agent") as string | undefined });

    const now = new Date();

    if (parsed.idempotency_key) {
      const existing = await getAttendanceByIdempotencyKey(parsed.idempotency_key);
      if (existing) {
        return json({ status: "replayed", attendance_reference: existing.attendanceReference, attendance_status: existing.attendanceStatus, checkout_at: existing.checkoutAt });
      }
    }

    const record = await getAttendanceByReference(parsed.attendance_reference);
    if (!record) return json({ error: "Attendance record not found" }, 404);
    if (record.eventId !== event.id) return json({ error: "Attendance record does not belong to this event" }, 400);
    if (record.attendanceStatus !== "CHECKED_IN") return json({ error: "Participant is not checked in", status: record.attendanceStatus }, 409);

    if (event.status !== "OPEN") return json({ error: "Event is not open", status: event.status }, 409);
    const checkoutStart = event.checkoutStartAt ? new Date(event.checkoutStartAt) : null;
    const checkoutEnd = event.checkoutEndAt ? new Date(event.checkoutEndAt) : null;
    if (!checkoutStart || !checkoutEnd) return json({ error: "Check-out window is not configured for this event" }, 409);
    if (now < checkoutStart || now > checkoutEnd) return json({ error: "Check-out window is not currently open", stage: "checkout" }, 409);

    const gpsErrors: string[] = [];
    if (!isValidCoordinate(latitude, longitude)) gpsErrors.push("Invalid GPS coordinates");
    if (!isGpsFresh(gps_timestamp, MAX_GPS_AGE_MS)) gpsErrors.push("GPS reading is stale. Please capture a fresh location.");
    if (accuracy > event.gpsAccuracyThresholdMeters) {
      gpsErrors.push(`GPS accuracy (${accuracy.toFixed(1)} m) exceeds the required threshold (${event.gpsAccuracyThresholdMeters} m).`);
    }

    let geofenceWithin = false;
    let distanceMeters: number | null = null;
    let geofenceResult: "PASSED" | "FAILED" | "SKIPPED" = "SKIPPED";

    if (event.latitude != null && event.longitude != null && isValidCoordinate(latitude, longitude)) {
      const { within, distanceMeters: d } = isWithinGeofence(latitude, longitude, event.latitude, event.longitude, event.geofenceRadiusMeters);
      geofenceWithin = within;
      distanceMeters = d;
      geofenceResult = event.requireGeofence ? (within ? "PASSED" : "FAILED") : "SKIPPED";
      if (event.requireGeofence && !within) {
        gpsErrors.push(`You are outside the permitted radius (${d.toFixed(0)} m from the event location).`);
      }
    }

    const verificationStatus = gpsErrors.length === 0 ? "PASSED" : "FAILED";
    if (verificationStatus === "FAILED") {
      return json({ error: "GPS verification failed", details: gpsErrors, verification: { status: "FAILED", geofence: geofenceResult, distanceMeters, accuracy } }, 400);
    }

    const evidenceRequired = event.requireCheckoutEvidence === "MANDATORY";
    const uploadedFile = formData.get("evidence") as File | null;
    let evidenceStored = false;
    let storageKey: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number | null = null;

    if (evidenceRequired) {
      if (!uploadedFile || uploadedFile.size === 0) {
        return json({ error: "Check-out evidence (photo) is required" }, 400);
      }
      const validation = validateFile(uploadedFile);
      if (!validation.ok) return json({ error: validation.error }, 400);
      const buffer = await readFileBuffer(uploadedFile);
      if (buffer.length > Number(process.env.UPLOAD_LIMIT_BYTES ?? 10 * 1024 * 1024)) {
        return json({ error: "File too large" }, 400);
      }
      const stored = await storeFile({ buffer, storageKey: `evidence/${event.id}/${record.id}/CHECK_OUT/${Date.now().toString(36)}`, mimeType: validation.file.mimeType, eventId: event.id });
      storageKey = stored.key;
      mimeType = validation.file.mimeType;
      fileSize = buffer.length;
      evidenceStored = true;
    }

    const checkoutAt = now;
    const durationSeconds = record.checkinAt ? Math.floor((checkoutAt.getTime() - new Date(record.checkinAt).getTime()) / 1000) : null;

    const updated = await withTx(async (tx) => {
      const [rec] = await tx.update(schemaAttendances)
        .set({
          checkoutAt: checkoutAt,
          checkoutLatitude: latitude,
          checkoutLongitude: longitude,
          checkoutAccuracy: accuracy,
          checkoutGpsTimestamp: new Date(gps_timestamp),
          checkoutVerificationStatus: verificationStatus,
          attendanceDurationSeconds: durationSeconds,
          attendanceStatus: "COMPLETED",
          checkoutEvidenceRequired: evidenceRequired,
        })
        .where(eq(schemaAttendances.id, record.id))
        .returning();

      await tx.insert(schemaVerificationLogs).values({
        attendanceRecordId: rec.id,
        stage: "CHECK_OUT",
        latitude,
        longitude,
        accuracy,
        calculatedDistance: distanceMeters,
        geofenceResult: geofenceResult !== "FAILED",
        verificationResult: verificationStatus,
        failureReason: gpsErrors.length > 0 ? gpsErrors.join("; ") : null,
      });

      if (evidenceStored && storageKey) {
        await tx.insert(schemaEvidence).values({
          attendanceRecordId: rec.id,
          stage: "CHECK_OUT",
          storageKey: storageKey,
          originalFilename: uploadedFile?.name ?? null,
          mimeType: mimeType ?? undefined,
          fileSize: fileSize ?? undefined,
          reviewStatus: "PENDING",
        });
      }

      return rec;
    });

    await createAuditLog({ action: "ATTENDANCE_CHECK_OUT", entityType: "AttendanceRecord", entityId: updated.id, newValues: { reference: updated.attendanceReference, checkout_at: checkoutAt, durationSeconds } });

    return json({
      status: "checked_out",
      attendance_reference: updated.attendanceReference,
      attendance_status: updated.attendanceStatus,
      checkout_at: updated.checkoutAt,
      attendance_duration_seconds: durationSeconds,
      verification: { status: verificationStatus, geofence: geofenceResult, distanceMeters, accuracy },
      evidence: evidenceStored ? { stored: true, storage_key: storageKey, mime_type: mimeType, size: fileSize } : { stored: false, required: evidenceRequired },
    });
  },
  { requireAuth: false }
);

export const POST = handler;
