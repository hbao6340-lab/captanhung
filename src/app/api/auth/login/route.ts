import { NextRequest, NextResponse } from "next/server";
import { withHandler, json, validateBody, logAudit } from "@/app/api/_lib/route-helper";
import { loginSchema } from "@/app/api/_lib/schemas";
import { verifyPassword, persistSession, updateUserLastLogin, createAccessToken, createRefreshToken, setAuthCookieHeaders } from "@/lib/auth";
import { getUserByEmail } from "@/db/repository";
import { createAuditLog } from "@/db/repository";

const handler = withHandler(
  async (req: NextRequest) => {
    const body = await validateBody(req, loginSchema);
    const { email, password } = body;

    const user = await getUserByEmail(email);
    if (!user) {
      await createAuditLog({ action: "AUTH_LOGIN_FAILED", entityType: "User", entityId: email, newValues: { reason: "user_not_found" } });
      return json({ error: "Invalid email or password" }, 401);
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await createAuditLog({ action: "AUTH_LOGIN_FAILED", entityType: "User", entityId: user.id, newValues: { reason: "wrong_password" } });
      return json({ error: "Invalid email or password" }, 401);
    }

    if (user.status !== "active") {
      return json({ error: "Account is not active" }, 403);
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = createAccessToken(payload);
    const refreshToken = createRefreshToken(payload);

    await persistSession({
      userId: user.id,
      accessToken,
      refreshToken,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    await updateUserLastLogin(user.id);

    await createAuditLog({ actorUserId: user.id, action: "AUTH_LOGIN", entityType: "User", entityId: user.id });

    const res = NextResponse.json({
      status: "ok",
      user: { id: user.id, full_name: user.fullName, email: user.email },
    });
    for (const c of setAuthCookieHeaders(accessToken, refreshToken)) {
      res.headers.append("Set-Cookie", c);
    }
    return res;
  }
);

export const POST = handler;
