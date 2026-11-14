import { NextRequest, NextResponse } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { exportReportSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import { listAllAttendance, createReportExport, createAuditLog } from "@/db/repository";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const EXPORT_DIR = join(/*turbopackIgnore: true*/ process.cwd(), "exports");
mkdirSync(/*turbopackIgnore: true*/ EXPORT_DIR, { recursive: true });

const rowsFromRecords = (records: any[]): any[] =>
  records.map(({ attendance_records: r, events: e }: any) => ({
    reference: r.attendance_reference,
    event_code: e?.event_code,
    event_title: e?.title,
    venue: e?.venue_name,
    participant_name: r.participant_name,
    participant_phone: r.participant_phone,
    participant_identifier: r.participant_identifier ?? "",
    participant_organization: r.participant_organization ?? "",
    participant_category: r.participant_category ?? "",
    checkin_at: r.checkin_at?.toISOString?.() ?? r.checkin_at ?? "",
    checkin_latitude: r.checkin_latitude ?? "",
    checkin_longitude: r.checkin_longitude ?? "",
    checkin_accuracy: r.checkin_accuracy ?? "",
    checkin_verification: r.checkin_verification_status,
    checkout_at: r.checkout_at?.toISOString?.() ?? r.checkout_at ?? "",
    checkout_latitude: r.checkout_latitude ?? "",
    checkout_longitude: r.checkout_longitude ?? "",
    checkout_accuracy: r.checkout_accuracy ?? "",
    checkout_verification: r.checkout_verification_status,
    attendance_duration_seconds: r.attendance_duration_seconds ?? "",
    attendance_duration_minutes: r.attendance_duration_seconds ? Math.round(r.attendance_duration_seconds / 60) : "",
    attendance_status: r.attendance_status,
    evidence_count: r.evidence_count ?? 0,
    created_at: r.created_at?.toISOString?.() ?? r.created_at ?? "",
  }));

const handler = withHandler(
  async (req: NextRequest) => {
    const user = await requireAuth();
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

    const records = await listAllAttendance({
      eventId: parsed.event_id,
      status: parsed.status,
      dateFrom,
      dateTo,
      participant: parsed.participant,
      organization: parsed.organization,
      limit: 10000,
    });

    const rows = rowsFromRecords(records);
    const headers = Object.keys(rows[0] ?? {});
    const fileName = `attendance-report-${randomUUID()}`;
    let filePath: string;
    let mime: string;
    let ext: string;

    if (parsed.format === "csv") {
      filePath = join(EXPORT_DIR, `${fileName}.csv`);
      ext = "csv";
      mime = "text/csv";
      const escape = (v: any) => {
        const s = String(v ?? "");
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
      writeFileSync(/*turbopackIgnore: true*/ filePath, lines.join("\n"));
    } else if (parsed.format === "xlsx") {
      filePath = join(EXPORT_DIR, `${fileName}.xlsx`);
      ext = "xlsx";
      mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Attendance");
      sheet.columns = headers.map((h) => ({ header: h, key: h }));
      sheet.addRows(rows);
      await workbook.xlsx.writeFile(filePath);
    } else if (parsed.format === "pdf") {
      // Simple PDF via pdfkit
      const { PDFDocument } = require("pdfkit");
      const fs = require("fs");
      filePath = join(EXPORT_DIR, `${fileName}.pdf`);
      ext = "pdf";
      mime = "application/pdf";
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      doc.fontSize(16).text("Attendance Report", { align: "center" });
      doc.moveDown().fontSize(10).text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown();
      const tableHeaders = headers.slice(0, 12);
      doc.text(tableHeaders.join(" | "));
      for (const r of rows.slice(0, 50)) {
        doc.text(tableHeaders.map((h) => r[h]).join(" | "));
      }
      doc.end();
      await new Promise((res) => stream.on("finish", res));
    } else {
      return json({ error: "Unsupported format" }, 400);
    }

    await createReportExport({ eventId: parsed.event_id ?? null, format: parsed.format, filePath, rowCount: rows.length, createdBy: user.id });
    await createAuditLog({ actorUserId: user.id, action: "REPORT_EXPORT", entityType: "ReportExport", newValues: { format: parsed.format, count: rows.length, file: fileName } });

    const buffer = readFileSync(/*turbopackIgnore: true*/ filePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": mime,
        "content-disposition": `attachment; filename="${fileName}.${ext}"`,
        "content-length": String(buffer.length),
      },
    });
  },
  { requireAuth: true }
);

export const GET = handler;
