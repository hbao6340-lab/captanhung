import { NextRequest } from "next/server";
import { withHandler, json } from "@/app/api/_lib/route-helper";
import { paginationSchema } from "@/app/api/_lib/schemas";
import { listEvents, countEvents } from "@/db/repository";

const listEventsHandler = withHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const parsed = paginationSchema.parse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  const now = new Date();
  const statuses = parsed.status ? undefined : ["OPEN", "UPCOMING"];

  const [events, total] = await Promise.all([
    listEvents({ search: parsed.search, statuses, limit: parsed.pageSize, offset: (parsed.page - 1) * parsed.pageSize }),
    countEvents({ search: parsed.search, statuses }),
  ]);

  return json({
    events,
    pagination: { page: parsed.page, pageSize: parsed.pageSize, total, totalPages: Math.ceil(total / parsed.pageSize) },
    serverTime: now.toISOString(),
  });
});

export const GET = withHandler(listEventsHandler);
