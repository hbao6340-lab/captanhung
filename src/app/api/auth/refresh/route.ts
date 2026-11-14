import { NextRequest, NextResponse } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import {
  getRefreshTokenFromCookies,
  decodeRefreshToken,
  createAccessToken,
  createRefreshToken,
  persistSession,
  setAuthCookieHeaders,
  revokeRefreshSession,
  updateUserLastLogin,
} from "@/lib/auth";
import { getUserById } from "@/db/repository";
import { createAuditLog } from "@/db/repository";

const handler = withHandler(
  async (req: NextRequest) => {
    const refreshToken = await getRefreshTokenFromCookies();
    if (!refreshToken) return json({ error: "No refresh token" }, 401);

    const payload = decodeRefreshToken(refreshToken);
    if (!payload) return json({ error: "Invalid refresh token" }, 401);

    const user = await getUserById(payload.userId);
    if (!user || user.status !== "active") return json({ error: "User not active" }, 403);

    const newAccess = createAccessToken({ userId: user.id, email: user.email, role: payload.role });
    const newRefresh = createRefreshToken({ userId: user.id, email: user.email, role: payload.role });

    await revokeRefreshSession(Buffer.from(refreshToken).toString("base64"));
    await persistSession({
      userId: user.id,
      accessToken: newAccess,
      refreshToken: newRefresh,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await updateUserLastLogin(user.id);

    const res = NextResponse.json({ status: "refreshed" });
    for (const c of setAuthCookieHeaders(newAccess, newRefresh)) {
      res.headers.append("Set-Cookie", c);
    }
    await createAuditLog({ actorUserId: user.id, action: "AUTH_REFRESH", entityType: "User", entityId: user.id });

    return res;
  }
);

export const POST = handler;
