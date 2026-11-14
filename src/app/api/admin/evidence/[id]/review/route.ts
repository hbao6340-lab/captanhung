import { NextRequest } from "next/server";
import { withHandler, json, validateBody, logAudit } from "@/app/api/_lib/route-helper";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/db/repository";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import * as schema from "@/db/schema";

let _db: ReturnType<typeof getDb> | null = null;
function getDbInst() { if (!_db) _db = getDb(); return _db; }
const db = getDbInst();

const reviewSchema = z.object({
  review_status: z.enum(["PENDING", "REVIEWED", "FLAGGED", "APPROVED"]),
  review_notes: z.string().optional(),
});

const handler = withHandler(
  async (req: NextRequest, { params }: any) => {
    const user = await requireAuth();
    const { id } = await params;
    const body = await validateBody(req, reviewSchema);

    const [updated] = await db.update(schema.attendanceEvidence)
      .set({ reviewStatus: body.review_status, reviewNotes: body.review_notes ?? null, reviewedBy: user.id, reviewedAt: new Date() })
      .where(eq(schema.attendanceEvidence.id, id))
      .returning();

    if (!updated) return json({ error: "Evidence not found" }, 404);

    await createAuditLog({ actorUserId: user.id, action: "EVIDENCE_REVIEW", entityType: "AttendanceEvidence", entityId: id, newValues: { review_status: body.review_status, notes: body.review_notes } });

    return json({ evidence: updated });
  },
  { requireAuth: true }
);

export const PATCH = handler;
