import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { createAuditLog, getAttendanceByIdempotencyKey } from "@/db/repository";

export interface RouteContext {
  params: Promise<{ [key: string]: string }> | { [key: string]: string };
}

export type Handler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse> | NextResponse;

export interface ApiErrorBody {
  error: string;
  details?: Record<string, string[]>;
  statusCode: number;
}

/**
 * Wrap a route handler with consistent error handling, JSON responses, and CORS-lite headers.
 */
export function withHandler(handler: Handler, options?: { requireAuth?: boolean; permissions?: string[] }) {
  return async (req: NextRequest, ctx: RouteContext): Promise<NextResponse> => {
    try {
      if (options?.requireAuth) {
        const user = await getCurrentUser();
        if (!user) {
          return json({ error: "Unauthenticated" }, 401);
        }
        if (options.permissions && options.permissions.length) {
          for (const perm of options.permissions) {
            const ok = await hasPermission(user as any, perm);
            if (!ok) {
              return json({ error: "Forbidden" }, 403);
            }
          }
        }
        (req as any).user = user;
      }

      const result = await handler(req, ctx);
      return result;
    } catch (err: any) {
      if (err.statusCode) {
        return json({ error: err.message }, err.statusCode);
      }
      if (err instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const path = issue.path.join(".");
          details[path] = [...(details[path] ?? []), issue.message];
        }
        return json({ error: "Validation failed", details }, 400);
      }
      console.error("API error:", err);
      return json({ error: "Internal server error" }, 500);
    }
  };
}

export function json(data: unknown, status = 200, init?: ResponseInit): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
}

export async function readBody<T>(req: NextRequest): Promise<T> {
  const text = await req.text();
  if (!text) throw Object.assign(new Error("Request body is required"), { statusCode: 400 });
  return JSON.parse(text) as T;
}

export async function validateBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const body = await readBody<T>(req);
  return schema.parse(body);
}

/**
 * Check idempotency key. Returns existing attendance record if already processed.
 */
export async function checkIdempotency(idempotencyKey: string | undefined) {
  if (!idempotencyKey) return null;
  return getAttendanceByIdempotencyKey(idempotencyKey);
}

export async function logAudit({
  actorUserId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  req,
}: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  req?: NextRequest;
}) {
  try {
    await createAuditLog({
      actorUserId,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress: req?.headers.get("x-forwarded-for") ?? req?.headers.get("x-real-ip") ?? undefined,
      userAgent: req?.headers.get("user-agent") ?? undefined,
    });
  } catch {
    // Audit logging must not break the main flow.
  }
}
