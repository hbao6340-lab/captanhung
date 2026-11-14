import { NextRequest } from "next/server";
import { withHandler, json, validateBody, logAudit } from "@/app/api/_lib/route-helper";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { repoListUsers, createUser as repoCreateUser, getRoleByName, assignUserRole, createAuditLog, getUserByEmail } from "@/db/repository";

const createUserSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.string().optional(),
  status: z.enum(["active", "suspended", "disabled"]).default("active"),
});

const listUsersHandler = withHandler(
  async (req: NextRequest) => {
    await requireAuth();
    const users = await repoListUsers();
    return json({ users });
  },
  { requireAuth: true }
);

const createUserHandler = withHandler(
  async (req: NextRequest) => {
    const actor = await requireAuth();
    const body = await validateBody(req, createUserSchema);

    const existing = await getUserByEmail(body.email);
    if (existing) return json({ error: "Email already in use" }, 409);

    const passwordHash = await hashPassword(body.password);

    const newUser = await repoCreateUser({
      fullName: body.full_name,
      email: body.email,
      phone: body.phone ?? null,
      passwordHash,
      status: body.status,
    });

    if (body.role) {
      const role = await getRoleByName(body.role);
      if (role) {
        await assignUserRole(newUser.id, role.id, actor.id);
      }
    }

    await createAuditLog({ actorUserId: actor.id, action: "USER_CREATE", entityType: "User", entityId: newUser.id, newValues: { email: newUser.email, role: body.role } });
    return json({ user: newUser }, 201);
  },
  { requireAuth: true }
);

export const GET = listUsersHandler;
export const POST = createUserHandler;
