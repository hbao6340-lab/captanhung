import { NextRequest } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { paginationSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import {
  listAllAttendance,
  countAllAttendance,
  createAuditLog,
  getEvidenceForRecord,
  getVerificationLogsForRecord,
} from "@/db/repository";

const handler = withHandler(
  async (req: NextRequest) => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const parsed = paginationSchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    // Support optional event_id filter
    const eventId = searchParams.get("event_id") ?? undefined;
    const dateFrom = searchParams.get("date_from") ?? undefined;
    const dateTo = searchParams.get("date_to") ?? undefined;
    const participant = searchParams.get("participant") ?? undefined;
    const organization = searchParams.get("organization") ?? undefined;

    const [records, total] = await Promise.all([
      listAllAttendance({
        eventId,
        status: parsed.status,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        participant,
        organization,
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
      }),
      countAllAttendance({
        eventId,
        status: parsed.status,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        participant,
        organization,
      }),
    ]);

    // Enrich with event info + evidence
    const enriched = await Promise.all(
      records.map(async (r: any) => {
        const evidence = await getEvidenceForRecord(r.attendance_records.id);
        const logs = await getVerificationLogsForRecord(r.attendance_records.id);
        return {
          ...r.attendance_records,
          event: r.events,
          evidence,
          verification_logs: logs.slice(0, 5),
        };
      })
    );

    await createAuditLog({ action: "ATTENDANCE_GLOBAL_LIST_VIEW", entityType: "AttendanceRecord" });

    return json({
      records: enriched,
      pagination: { page: parsed.page, pageSize: parsed.pageSize, total, totalPages: Math.ceil(total / parsed.pageSize) },
    });
  },
  { requireAuth: true }
);

export const GET = handler;
