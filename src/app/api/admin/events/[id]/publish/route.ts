import { NextRequest } from "next/server";
import { withHandler, json, logAudit } from "@/app/api/_lib/route-helper";
import { requireAuth } from "@/lib/auth";
import { getEventById, updateEvent, createAuditLog } from "@/db/repository";

const handler = withHandler(
  async (req: NextRequest, { params }: any) => {
    const user = await requireAuth();
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) return json({ error: "Event not found" }, 404);

    const updated = await updateEvent(id, { status: "UPCOMING", published_at: new Date() });
    await createAuditLog({ actorUserId: user.id, action: "EVENT_PUBLISH", entityType: "Event", entityId: id, newValues: { status: "UPCOMING" } });
    return json({ event: updated });
  },
  { requireAuth: true }
);

export const POST = handler;
