import { NextRequest } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { paginationSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import { getEventById, listAttendance, countAttendance, createAuditLog, getEvidenceForRecord, getVerificationLogsForRecord } from "@/db/repository";

const handler = withHandler(
  async (req: NextRequest, { params }: any) => {
    await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const parsed = paginationSchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const event = await getEventById(id);
    if (!event) return json({ error: "Event not found" }, 404);

    const [records, total] = await Promise.all([
      listAttendance({ eventId: id, search: parsed.search, status: parsed.status, limit: parsed.pageSize, offset: (parsed.page - 1) * parsed.pageSize }),
      countAttendance({ eventId: id, search: parsed.search, status: parsed.status }),
    ]);

    // Enrich with evidence + latest verification log per record
    const enriched = await Promise.all(records.map(async (r) => {
      const evidence = await getEvidenceForRecord(r.id);
      const logs = await getVerificationLogsForRecord(r.id);
      return { ...r, evidence, verification_logs: logs.slice(0, 5) };
    }));

    await createAuditLog({ action: "ATTENDANCE_LIST_VIEW", entityType: "Event", entityId: id });

    return json({
      records: enriched,
      event: { id: event.id, event_code: event.eventCode, title: event.title, status: event.status },
      pagination: { page: parsed.page, pageSize: parsed.pageSize, total, totalPages: Math.ceil(total / parsed.pageSize) },
    });
  },
  { requireAuth: true }
);

export const GET = handler;
