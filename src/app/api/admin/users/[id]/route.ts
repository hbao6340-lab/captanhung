import { NextRequest } from "next/server";
import { withHandler, json, validateBody, logAudit } from "@/app/api/_lib/route-helper";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { getUserById, updateUser as repoUpdateUser, getUserByEmail, createAuditLog } from "@/db/repository";

const updateUserSchema = z.object({
  full_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  status: z.enum(["active", "suspended", "disabled"]).optional(),
});

const getUser = withHandler(
  async (req: NextRequest, { params }: any) => {
    await requireAuth();
    const { id } = await params;
    const user = await getUserById(id);
    if (!user) return json({ error: "User not found" }, 404);
    return json({ user });
  },
  { requireAuth: true }
);

const updateUserHandler = withHandler(
  async (req: NextRequest, { params }: any) => {
    const actor = await requireAuth();
    const { id } = await params;
    const body = await validateBody(req, updateUserSchema);
    const existing = await getUserById(id);
    if (!existing) return json({ error: "User not found" }, 404);

    if (body.email && body.email !== existing.email) {
      const taken = await getUserByEmail(body.email);
      if (taken) return json({ error: "Email already in use" }, 409);
    }

    const data: Record<string, any> = {};
    if (body.full_name !== undefined) data.fullName = body.full_name;
    if (body.email !== undefined) data.email = body.email;
    if (body.phone !== undefined) data.phone = body.phone ?? null;
    if (body.status !== undefined) data.status = body.status;
    if (body.password) data.passwordHash = await hashPassword(body.password);

    const updated = await repoUpdateUser(id, data);
    await createAuditLog({ actorUserId: actor.id, action: "USER_UPDATE", entityType: "User", entityId: id, newValues: data });
    return json({ user: updated });
  },
  { requireAuth: true }
);

export const GET = getUser;
export const PATCH = updateUserHandler;
