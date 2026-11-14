import { NextRequest } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { exportReportSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import { listAllAttendance, countAllAttendance, createAuditLog } from "@/db/repository";

const handler = withHandler(
  async (req: NextRequest) => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const parsed = exportReportSchema.parse({
      event_id: searchParams.get("event_id") ?? undefined,
      format: searchParams.get("format") ?? "csv",
      status: searchParams.get("status") ?? undefined,
      date_from: searchParams.get("date_from") ?? undefined,
      date_to: searchParams.get("date_to") ?? undefined,
      participant: searchParams.get("participant") ?? undefined,
      organization: searchParams.get("organization") ?? undefined,
    });

    const dateFrom = parsed.date_from ? new Date(parsed.date_from) : undefined;
    const dateTo = parsed.date_to ? new Date(parsed.date_to) : undefined;

    const [records, total] = await Promise.all([
      listAllAttendance({
        eventId: parsed.event_id,
        status: parsed.status,
        dateFrom,
        dateTo,
        participant: parsed.participant,
        organization: parsed.organization,
        limit: 500,
      }),
      countAllAttendance({
        eventId: parsed.event_id,
        status: parsed.status,
        dateFrom,
        dateTo,
        participant: parsed.participant,
        organization: parsed.organization,
      }),
    ]);

    await createAuditLog({ action: "REPORT_VIEW", entityType: "AttendanceRecord", newValues: { filter: parsed, count: records.length } });

    return json({
      format: parsed.format,
      count: records.length,
      total,
      records: records.map((r) => ({
        ...r.attendance_records,
        event: r.events,
      })),
    });
  },
  { requireAuth: true }
);

export const GET = handler;
