import { NextRequest } from "next/server";
import { withHandler, json, validateBody, logAudit } from "@/app/api/_lib/route-helper";
import { updateEventSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import { getEventById, updateEvent as repoUpdateEvent, listCustomFields, createCustomFields, createAuditLog } from "@/db/repository";
import { hash } from "argon2";

const getEvent = withHandler(
  async (req: NextRequest, { params }: any) => {
    await requireAuth();
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) return json({ error: "Event not found" }, 404);
    const customFields = await listCustomFields(id);
    return json({ event: { ...event, custom_fields: customFields } });
  },
  { requireAuth: true }
);

const updateEventHandler = withHandler(
  async (req: NextRequest, { params }: any) => {
    const user = await requireAuth();
    const { id } = await params;
    const body = await validateBody(req, updateEventSchema);

    const existing = await getEventById(id);
    if (!existing) return json({ error: "Event not found" }, 404);

    let accessCodeHash = existing.accessCodeHash;
    if (body.access_code !== undefined) {
      accessCodeHash = body.access_code ? await hash(body.access_code, { type: 2 }) : null;
    }

    const event = await repoUpdateEvent(id, {
      title: body.title,
      description: body.description,
      venue_name: body.venue_name,
      venue_address: body.venue_address,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      geofence_radius_meters: body.geofence_radius_meters,
      checkin_start_at: body.checkin_start_at ? new Date(body.checkin_start_at) : undefined,
      checkin_end_at: body.checkin_end_at ? new Date(body.checkin_end_at) : undefined,
      checkout_start_at: body.checkout_start_at ? new Date(body.checkout_start_at) : undefined,
      checkout_end_at: body.checkout_end_at ? new Date(body.checkout_end_at) : undefined,
      timezone: body.timezone,
      access_type: body.access_type,
      access_code_hash: accessCodeHash,
      require_login: body.require_login,
      require_gps_checkin: body.require_gps_checkin,
      require_gps_checkout: body.require_gps_checkout,
      gps_accuracy_threshold_meters: body.gps_accuracy_threshold_meters,
      require_geofence: body.require_geofence,
      require_checkout_evidence: body.require_checkout_evidence,
      evidence_mode: body.require_checkout_evidence,
      allow_multiple_attendance: body.allow_multiple_attendance,
      max_attendance: body.max_attendance ?? null,
    });

    if (body.custom_fields) {
      await createCustomFields(id, body.custom_fields);
    }

    await createAuditLog({ actorUserId: user.id, action: "EVENT_UPDATE", entityType: "Event", entityId: id, oldValues: existing, newValues: event });

    return json({ event });
  },
  { requireAuth: true }
);

export const GET = getEvent;
export const PATCH = updateEventHandler;
