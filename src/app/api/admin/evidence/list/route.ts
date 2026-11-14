import { NextRequest } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { paginationSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/db/repository";
import { eq, and, or, ilike, desc, count as countRows } from "drizzle-orm";
import { getDb } from "@/db/index";
import * as schema from "@/db/schema";

let _db: ReturnType<typeof getDb> | null = null;
function getDbInst() { if (!_db) _db = getDb(); return _db; }
const db = getDbInst();

const handler = withHandler(
  async (req: NextRequest) => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const parsed = paginationSchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      search: searchParams.get("search") ?? undefined,
    });
    const stage = searchParams.get("stage") ?? undefined;
    const reviewStatus = searchParams.get("review_status") ?? undefined;

    const conditions: any[] = [];
    if (stage) conditions.push(eq(schema.attendanceEvidence.stage, stage as any));
    if (reviewStatus) conditions.push(eq(schema.attendanceEvidence.reviewStatus, reviewStatus as any));
    if (parsed.search) {
      conditions.push(
        or(
          ilike(schema.attendanceEvidence.originalFilename, `%${parsed.search}%`),
          ilike(schema.attendanceEvidence.storageKey, `%${parsed.search}%`)
        )
      );
    }
    const where = and(...conditions);

    const rows = await db
      .select({
        evidence: schema.attendanceEvidence,
        attendanceRecord: schema.attendanceRecords,
        event: schema.events,
      })
      .from(schema.attendanceEvidence)
      .leftJoin(schema.attendanceRecords, eq(schema.attendanceEvidence.attendanceRecordId, schema.attendanceRecords.id))
      .leftJoin(schema.events, eq(schema.attendanceRecords.eventId, schema.events.id))
      .where(where)
      .orderBy(desc(schema.attendanceEvidence.uploadedAt))
      .limit(parsed.pageSize)
      .offset((parsed.page - 1) * parsed.pageSize);

    const [{ count }] = await db.select({ count: countRows() }).from(schema.attendanceEvidence).where(where);

    const items = rows.map((r: any) => ({
      id: r.evidence.id,
      attendance_record_id: r.evidence.attendanceRecordId,
      stage: r.evidence.stage,
      storage_key: r.evidence.storageKey,
      original_filename: r.evidence.originalFilename,
      mime_type: r.evidence.mimeType,
      file_size: r.evidence.fileSize,
      uploaded_at: r.evidence.uploadedAt,
      review_status: r.evidence.reviewStatus,
      review_notes: r.evidence.reviewNotes,
      reviewed_by: r.evidence.reviewedBy,
      reviewed_at: r.evidence.reviewedAt,
      attendance_record: {
        attendance_reference: r.attendanceRecord?.attendanceReference ?? "",
        participant_name: r.attendanceRecord?.participantName ?? "",
        participant_phone: r.attendanceRecord?.participantPhone ?? "",
        event: r.event ? {
          id: r.event.id,
          event_code: r.event.eventCode,
          title: r.event.title,
        } : null,
      },
    }));

    await createAuditLog({ action: "EVIDENCE_LIST_VIEW", entityType: "AttendanceEvidence" });

    return json({
      items,
      pagination: { page: parsed.page, pageSize: parsed.pageSize, total: Number(count), totalPages: Math.ceil(Number(count) / parsed.pageSize) },
    });
  },
  { requireAuth: true }
);

export const GET = handler;
