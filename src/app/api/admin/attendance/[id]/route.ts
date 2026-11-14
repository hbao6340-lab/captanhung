import { NextRequest } from "next/server";
import { withHandler, json, validateBody, logAudit } from "@/app/api/_lib/route-helper";
import { attendanceStatusUpdateSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import { getAttendanceById, updateAttendance, createAuditLog, getEvidenceForRecord, getVerificationLogsForRecord, getCustomFieldValuesForRecord } from "@/db/repository";

const getRecord = withHandler(
  async (req: NextRequest, { params }: any) => {
    await requireAuth();
    const { id } = await params;
    const record = await getAttendanceById(id);
    if (!record) return json({ error: "Attendance record not found" }, 404);
    const [evidence, logs, cfv] = await Promise.all([
      getEvidenceForRecord(id),
      getVerificationLogsForRecord(id),
      getCustomFieldValuesForRecord(id),
    ]);
    return json({ record: { ...record, evidence, verification_logs: logs, custom_field_values: cfv } });
  },
  { requireAuth: true }
);

const updateRecord = withHandler(
  async (req: NextRequest, { params }: any) => {
    const user = await requireAuth();
    const { id } = await params;
    const body = await validateBody(req, attendanceStatusUpdateSchema);

    const existing = await getAttendanceById(id);
    if (!existing) return json({ error: "Attendance record not found" }, 404);

    const updated = await updateAttendance(id, { attendance_status: body.attendance_status });

    await createAuditLog({
      actorUserId: user.id,
      action: "ATTENDANCE_CORRECT",
      entityType: "AttendanceRecord",
      entityId: id,
      oldValues: { attendance_status: existing.attendanceStatus },
      newValues: { attendance_status: body.attendance_status, notes: body.admin_notes },
    });

    return json({ record: updated });
  },
  { requireAuth: true }
);

export const GET = getRecord;
export const PATCH = updateRecord;
