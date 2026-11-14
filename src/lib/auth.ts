import { hash, verify } from "argon2";
import { sign, verify as jwtVerify, JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";
import {
  getUserByEmail,
  getUserRolesWithPermissions,
  createSession,
  revokeSessionByTokenHash,
  revokeSessionByRefreshHash,
  updateUser,
  getUserById,
} from "@/db/repository";

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900); // 15 min
const REFRESH_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 604800); // 7 days

export type TokenPayload = {
  userId: string;
  email: string;
  role?: string;
} & JwtPayload;

function requireSecrets() {
  if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set");
  }
}

function signAccessToken(payload: TokenPayload): string {
  requireSecrets();
  return sign(payload, ACCESS_SECRET!, { expiresIn: `${ACCESS_TTL_SECONDS}s` });
}

function signRefreshToken(payload: TokenPayload): string {
  requireSecrets();
  return sign(payload, REFRESH_SECRET!, { expiresIn: `${REFRESH_TTL_SECONDS}s` });
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { type: 2 }); // Argon2id
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return verify(hash, password);
}

export function createAccessToken(payload: TokenPayload): string {
  return signAccessToken(payload);
}

export function createRefreshToken(payload: TokenPayload): string {
  return signRefreshToken(payload);
}

export function decodeAccessToken(token: string): TokenPayload | null {
  try {
    return jwtVerify(token, ACCESS_SECRET!) as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export function decodeRefreshToken(token: string): TokenPayload | null {
  try {
    return jwtVerify(token, REFRESH_SECRET!) as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export const COOKIE_ACCESS = "cap_access_token";
export const COOKIE_REFRESH = "cap_refresh_token";

export function setAuthCookieHeaders(accessToken: string, refreshToken: string): string[] {
  const secure = process.env.NODE_ENV === "production";
  return [
    serializeCookie(COOKIE_ACCESS, accessToken, { secure, sameSite: "lax", path: "/", maxAge: ACCESS_TTL_SECONDS }),
    serializeCookie(COOKIE_REFRESH, refreshToken, { secure, sameSite: "lax", path: "/", maxAge: REFRESH_TTL_SECONDS }),
  ];
}

export function clearAuthCookieHeaders(): string[] {
  return [serializeCookie(COOKIE_ACCESS, "", { path: "/", maxAge: 0 }), serializeCookie(COOKIE_REFRESH, "", { path: "/", maxAge: 0 })];
}

function serializeCookie(name: string, value: string, opts: { path?: string; maxAge?: number; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: "lax" | "strict" | "none" }): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.secure) parts.push("Secure");
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join("; ");
}

export async function getAccessTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_ACCESS)?.value ?? null;
}

export async function getRefreshTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_REFRESH)?.value ?? null;
}

/**
 * Get the current authenticated user from the access token cookie.
 * Returns null when there is no valid session.
 */
export async function getCurrentUser() {
  const token = await getAccessTokenFromCookies();
  if (!token) return null;
  const payload = decodeAccessToken(token);
  if (!payload) return null;
  const user = await getUserById(payload.userId);
  if (!user || user.status !== "active") return null;

  const rows = await getUserRolesWithPermissions(user.id);
  const roles = [...new Set(rows.map((r: any) => r.role.name))];
  const permissions = [...new Set(rows.map((r: any) => r.permissions?.name).filter(Boolean))];
  const topRole = roles.includes("ADMIN") ? "ADMIN" : roles.includes("MANAGER") ? "MANAGER" : roles[0] ?? "STAFF";

  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    email_verified: user.emailVerified,
    last_login_at: user.lastLoginAt,
    role: topRole,
    roles,
    permissions,
  };
}

/**
 * Require an authenticated user. Throws a standardized error when absent.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const err: any = new Error("Unauthenticated");
    err.statusCode = 401;
    throw err;
  }
  return user;
}

/**
 * Check whether the current user has a given permission name.
 */
export async function hasPermission(user: { permissions: string[] }, permissionName: string): Promise<boolean> {
  return user.permissions.includes(permissionName);
}

export async function requirePermission(permissionName: string) {
  const user = await requireAuth();
  if (!user.permissions.includes(permissionName)) {
    const err: any = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
  return user;
}

export const ROLE_ADMIN = "ADMIN";
export const ROLE_MANAGER = "MANAGER";
export const ROLE_STAFF = "STAFF";

export const PERM_EVENT_CREATE = "event:create";
export const PERM_EVENT_EDIT = "event:edit";
export const PERM_EVENT_PUBLISH = "event:publish";
export const PERM_EVENT_OPEN = "event:open";
export const PERM_EVENT_CLOSE = "event:close";
export const PERM_ATTENDANCE_VIEW = "attendance:view";
export const PERM_ATTENDANCE_EXPORT = "attendance:export";
export const PERM_ATTENDANCE_CORRECT = "attendance:correct";
export const PERM_EVIDENCE_REVIEW = "evidence:review";
export const PERM_USER_MANAGE = "user:manage";
export const PERM_SETTINGS = "settings:read";
export const PERM_AUDIT_VIEW = "audit:view";

export async function revokeAccessSession(tokenHash: string) {
  await revokeSessionByTokenHash(tokenHash);
}

export async function revokeRefreshSession(hash: string) {
  await revokeSessionByRefreshHash(hash);
}

export async function persistSession({
  userId,
  accessToken,
  refreshToken,
  ipAddress,
  userAgent,
}: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await createSession({
    userId,
    tokenHash: Buffer.from(accessToken).toString("base64"),
    refreshTokenHash: Buffer.from(refreshToken).toString("base64"),
    expiresAt: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    ipAddress,
    userAgent,
  });
}

export async function updateUserLastLogin(userId: string) {
  await updateUser(userId, { lastLoginAt: new Date() });
}
