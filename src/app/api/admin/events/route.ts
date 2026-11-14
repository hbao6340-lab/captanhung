import { NextRequest } from "next/server";
import { withHandler, json, validateBody, logAudit } from "@/app/api/_lib/route-helper";
import { createEventSchema, paginationSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import {
  listEvents as repoListEvents,
  countEvents,
  createEvent as repoCreateEvent,
  createCustomFields,
  getEventByCode,
  createAuditLog,
} from "@/db/repository";
import { hash } from "argon2";
import crypto from "crypto";

function generateEventCode(title: string): string {
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  const slug = title.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${slug}${rand}`.slice(0, 12) || `EVT${rand}`;
}

const listEventsHandler = withHandler(
  async (req: NextRequest) => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const parsed = paginationSchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const [events, total] = await Promise.all([
      repoListEvents({ search: parsed.search, status: parsed.status, limit: parsed.pageSize, offset: (parsed.page - 1) * parsed.pageSize }),
      countEvents({ search: parsed.search, status: parsed.status }),
    ]);

    return json({
      events,
      pagination: { page: parsed.page, pageSize: parsed.pageSize, total, totalPages: Math.ceil(total / parsed.pageSize) },
    });
  },
  { requireAuth: true }
);

const createEventHandler = withHandler(
  async (req: NextRequest) => {
    const user = await requireAuth();
    const body = await validateBody(req, createEventSchema);

    let eventCode = generateEventCode(body.title);
    let existing = await getEventByCode(eventCode);
    let attempts = 0;
    while (existing && attempts < 10) {
      eventCode = generateEventCode(body.title);
      existing = await getEventByCode(eventCode);
      attempts++;
    }
    if (existing) {
      return json({ error: "Unable to generate a unique event code" }, 409);
    }

    let accessCodeHash: string | undefined;
    if (body.access_code) {
      accessCodeHash = await hash(body.access_code, { type: 2 });
    }

    const checkoutStart = body.checkout_start_at ? new Date(body.checkout_start_at) : null;
    const checkoutEnd = body.checkout_end_at ? new Date(body.checkout_end_at) : null;

    const event = await repoCreateEvent({
      event_code: eventCode,
      title: body.title,
      description: body.description,
      venue_name: body.venue_name,
      venue_address: body.venue_address,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      geofence_radius_meters: body.geofence_radius_meters,
      checkin_start_at: new Date(body.checkin_start_at),
      checkin_end_at: new Date(body.checkin_end_at),
      checkout_start_at: checkoutStart,
      checkout_end_at: checkoutEnd,
      timezone: body.timezone,
      status: "DRAFT",
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
      created_by: user.id,
    });

    if (body.custom_fields && body.custom_fields.length) {
      await createCustomFields(event.id, body.custom_fields);
    }

    await logAudit({ actorUserId: user.id, action: "EVENT_CREATE", entityType: "Event", entityId: event.id, newValues: { code: event.eventCode, title: event.title } });

    return json({ event }, 201);
  },
  { requireAuth: true }
);

export const GET = listEventsHandler;
export const POST = createEventHandler;
