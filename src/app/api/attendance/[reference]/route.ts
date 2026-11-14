import { NextRequest } from "next/server";
import { withHandler, json } from "@/app/api/_lib/route-helper";
import { getAttendanceByReference, getEvidenceForRecord } from "@/db/repository";

const handler = withHandler(async (req: NextRequest, { params }: any) => {
  const { reference } = await params;
  if (!reference) return json({ error: "Reference is required" }, 400);

  const record = await getAttendanceByReference(reference);
  if (!record) return json({ error: "Attendance record not found" }, 404);

  const evidence = await getEvidenceForRecord(record.id);

  return json({ record: { ...record, evidence } });
});

export const GET = handler;
