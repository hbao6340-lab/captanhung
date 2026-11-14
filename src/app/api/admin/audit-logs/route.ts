import { NextRequest } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { paginationSchema } from "@/app/api/_lib/schemas";
import { requireAuth } from "@/lib/auth";
import { listAuditLogs, countAuditLogs, createAuditLog } from "@/db/repository";

const handler = withHandler(
  async (req: NextRequest) => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const parsed = paginationSchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      search: searchParams.get("search") ?? undefined,
    });

    const [logs, total] = await Promise.all([
      listAuditLogs({ search: parsed.search }),
      countAuditLogs({ search: parsed.search }),
    ]);

    await createAuditLog({ action: "AUDIT_LOG_VIEW", entityType: "AuditLog" });

    return json({
      logs,
      pagination: { page: parsed.page, pageSize: parsed.pageSize, total, totalPages: Math.ceil(total / parsed.pageSize) },
    });
  },
  { requireAuth: true }
);

export const GET = handler;
