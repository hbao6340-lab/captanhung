import { NextRequest } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { requireAuth } from "@/lib/auth";
import { dashboardStats, recentAttendanceActivity, createAuditLog } from "@/db/repository";

const handler = withHandler(
  async (req: NextRequest) => {
    await requireAuth();
    const now = new Date();
    const stats = await dashboardStats();
    const recentActivity = await recentAttendanceActivity();

    await createAuditLog({ action: "DASHBOARD_VIEW", entityType: "Dashboard" });

    return json({
      stats,
      recent_activity: recentActivity,
      server_time: now.toISOString(),
    });
  },
  { requireAuth: true }
);

export const GET = handler;
