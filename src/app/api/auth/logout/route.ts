import { NextRequest, NextResponse } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { getCurrentUser, revokeAccessSession, clearAuthCookieHeaders } from "@/lib/auth";
import { createAuditLog } from "@/db/repository";
import { cookies } from "next/headers";

const handler = withHandler(
  async (req: NextRequest) => {
    const cookieStore = await cookies();
    const token = cookieStore.get("cap_access_token")?.value;
    let userId: string | undefined;
    if (token) {
      const user = await getCurrentUser();
      userId = user?.id;
      await revokeAccessSession(token);
    }

    const res = NextResponse.json({ status: "logged_out" });
    for (const c of clearAuthCookieHeaders()) {
      res.headers.append("Set-Cookie", c);
    }
    await createAuditLog({ actorUserId: userId, action: "AUTH_LOGOUT", entityType: "Session", entityId: token ?? undefined });

    return res;
  },
  { requireAuth: false }
);

export const POST = handler;
