import { NextRequest, NextResponse } from "next/server";
import { withHandler, json } from "@/app/api/_lib/route-helper";
import { requireAuth } from "@/lib/auth";
import { getEvidenceByStorageKey } from "@/db/repository";
import { getFileBuffer } from "@/lib/storage";

const handler = withHandler(
  async (req: NextRequest) => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const storageKey = searchParams.get("key") ?? "";
    if (!storageKey) return json({ error: "Missing storage key" }, 400);

    const evidence = await getEvidenceByStorageKey(storageKey);
    if (!evidence) return json({ error: "Evidence not found" }, 404);

    const file = await getFileBuffer(storageKey);
    if (!file) return json({ error: "File not available" }, 404);

    return new NextResponse(new Blob([new Uint8Array(file.buffer)]), {
      status: 200,
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `inline; filename="${evidence.id}"`,
        "cache-control": "private, no-store",
      },
    });
  },
  { requireAuth: true }
);

export const GET = handler;
