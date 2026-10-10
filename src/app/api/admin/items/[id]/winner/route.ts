import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond, safeError } from "@/lib/apiAuth";
import { declareWinnerSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { serializeAdminItem } from "@/lib/adminItems";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Declare (or clear) the winning bid. Passing { bidId: null } clears it.
 * Passing a bid id must be a bid that belongs to THIS item. If the body is
 * omitted entirely, default to the current highest bid — the common case of
 * "close and award to the top bid".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const item = await prisma.item.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let bidId: string | null;
  const text = await req.text();
  if (!text.trim()) {
    // No body → award to the highest bid.
    const top = await prisma.bid.findFirst({
      where: { itemId: id },
      orderBy: [{ amountCents: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!top) {
      return NextResponse.json({ error: "This item has no bids to award." }, { status: 400 });
    }
    bidId = top.id;
  } else {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const parsed = declareWinnerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid winner selection." }, { status: 400 });
    }
    bidId = parsed.data.bidId;
    if (bidId) {
      const owned = await prisma.bid.findFirst({
        where: { id: bidId, itemId: id },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { error: "That bid does not belong to this item." },
          { status: 400 },
        );
      }
    }
  }

  try {
    await prisma.item.update({ where: { id }, data: { winnerBidId: bidId } });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: bidId ? "item.winner.declare" : "item.winner.clear",
      entityType: "Item",
      entityId: id,
      changeSummary: bidId
        ? `Declared winner for "${item.title}".`
        : `Cleared the declared winner for "${item.title}".`,
    });
    const updated = await serializeAdminItem(id);
    return NextResponse.json({ item: updated });
  } catch (err) {
    logger.error({ err }, "admin.item.winner.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
