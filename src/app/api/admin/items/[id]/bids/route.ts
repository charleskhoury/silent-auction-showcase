import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond, safeError } from "@/lib/apiAuth";
import { adminAddBidSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { formatCents } from "@/lib/money";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Full bid history for an item, newest first, with bidder contact so the
 * committee can reach the winner (and runners-up if needed). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, title: true, winnerBidId: true },
  });
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const bids = await prisma.bid.findMany({
    where: { itemId: id },
    orderBy: [{ amountCents: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      amountCents: true,
      createdAt: true,
      bidder: { select: { name: true, mobile: true } },
    },
  });

  return NextResponse.json({
    item: { id: item.id, title: item.title, winnerBidId: item.winnerBidId },
    bids: bids.map((b) => ({
      id: b.id,
      amountCents: b.amountCents,
      createdAt: b.createdAt.toISOString(),
      bidderName: b.bidder.name,
      bidderMobile: b.bidder.mobile,
    })),
  });
}

/**
 * Admin override: record a bid for an already-registered bidder at any amount,
 * bypassing the normal min-increment / open-status rules (e.g. a guest who
 * gave a committee member a number verbally).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const item = await prisma.item.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = adminAddBidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a bidder and enter a valid amount." }, { status: 400 });
  }

  try {
    const bidder = await prisma.bidder.findUnique({
      where: { id: parsed.data.bidderId },
      select: { id: true, name: true },
    });
    if (!bidder) return NextResponse.json({ error: "Bidder not found." }, { status: 400 });

    const bid = await prisma.bid.create({
      data: { itemId: id, bidderId: bidder.id, amountCents: parsed.data.amountCents },
      select: { id: true },
    });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: "bid.override.add",
      entityType: "Bid",
      entityId: bid.id,
      changeSummary: `Manually added ${bidder.name}'s ${formatCents(parsed.data.amountCents)} bid on "${item.title}".`,
    });
    return NextResponse.json({ ok: true, bidId: bid.id }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "admin.bid.add.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
