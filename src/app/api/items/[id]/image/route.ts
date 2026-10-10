import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Serve an item's photo from the DB. Public — DRAFT items included so the
 * admin can preview an image before opening the item. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    select: { imageData: true, imageType: true, updatedAt: true },
  });

  if (!item?.imageData || !item.imageType) {
    return new NextResponse(null, { status: 404 });
  }

  const body = new Uint8Array(item.imageData);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": item.imageType,
      // Bytes never change for a given updatedAt; the client cache-busts with
      // ?v=<updatedAt> so a replaced photo is fetched fresh.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": item.updatedAt.toUTCString(),
    },
  });
}
