import { NextRequest } from "next/server";
import { withHandler, json } from "@/app/api/_lib/route-helper";
import { requireAuth } from "@/lib/auth";
import { listPermissions } from "@/db/repository";

const handler = withHandler(
  async () => {
    await requireAuth();
    const permissions = await listPermissions();
    return json({ permissions });
  },
  { requireAuth: true }
);

export const GET = handler;
