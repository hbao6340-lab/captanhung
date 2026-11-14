import { NextRequest } from "next/server";
import { withHandler, json } from "@/app/api/_lib/route-helper";
import { eventCodeSchema } from "@/app/api/_lib/schemas";
import { getEventByCode, listCustomFields } from "@/db/repository";

const getEvent = withHandler(async (req: NextRequest, { params }: any) => {
  const { code } = await params;
  eventCodeSchema.parse({ code });

  const event = await getEventByCode(code);
  if (!event) return json({ error: "Event not found" }, 404);

  const customFields = await listCustomFields(event.id);

  // Never expose access code hash to the public.
  const { accessCodeHash: _hash, ...safeEvent } = event;

  const now = new Date();
  const checkinStart = new Date(event.checkinStartAt);
  const checkinEnd = new Date(event.checkinEndAt);
  const checkoutStart = event.checkoutStartAt ? new Date(event.checkoutStartAt) : null;
  const checkoutEnd = event.checkoutEndAt ? new Date(event.checkoutEndAt) : null;

  let stage: "closed" | "checkin" | "checkout" | "between" | "upcoming" = "closed";
  if (["CLOSED", "CANCELLED", "COMPLETED"].includes(event.status)) {
    stage = "closed";
  } else if (now >= checkinStart && now <= checkinEnd) {
    stage = "checkin";
  } else if (checkoutStart && checkoutEnd && now >= checkoutStart && now <= checkoutEnd) {
    stage = "checkout";
  } else if (now < checkinStart) {
    stage = "upcoming";
  } else {
    stage = "between";
  }

  return json({
    event: { ...safeEvent, custom_fields: customFields },
    serverTime: now.toISOString(),
    stage,
    canCheckIn: stage === "checkin" && event.status === "OPEN",
    canCheckOut: stage === "checkout" && event.status === "OPEN",
  });
});

export const GET = withHandler(getEvent);
