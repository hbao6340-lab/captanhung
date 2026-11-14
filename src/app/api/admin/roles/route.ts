import { NextRequest } from "next/server";
import { withHandler, json } from "@/app/api/_lib/route-helper";
import { requireAuth } from "@/lib/auth";
import { listRoles } from "@/db/repository";

const handler = withHandler(
  async () => {
    await requireAuth();
    const roles = await listRoles();
    return json({ roles });
  },
  { requireAuth: true }
);

export const GET = handler;
