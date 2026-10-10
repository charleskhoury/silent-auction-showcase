import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond, safeError } from "@/lib/apiAuth";
import { adminBidAmountSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { formatCents } from "@/lib/money";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Admin override: change an existing bid's amount, bypassing the normal
 * minimum-increment / open-status rules (e.g. correcting a mistyped bid).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = adminBidAmountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  try {
    const existing = await prisma.bid.findUnique({
      where: { id },
      select: { amountCents: true, itemId: true, bidder: { select: { name: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Bid not found." }, { status: 404 });

    await prisma.bid.update({ where: { id }, data: { amountCents: parsed.data.amountCents } });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: "bid.override.edit",
      entityType: "Bid",
      entityId: id,
      changeSummary: `Changed ${existing.bidder.name}'s bid from ${formatCents(existing.amountCents)} to ${formatCents(parsed.data.amountCents)}.`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin.bid.edit.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}

/**
 * Admin override: void (delete) a bid. If it was the declared winner, the
 * Item.winnerBidId FK is ON DELETE SET NULL, so the pointer clears itself.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  try {
    const existing = await prisma.bid.findUnique({
      where: { id },
      select: { amountCents: true, itemId: true, bidder: { select: { name: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Bid not found." }, { status: 404 });

    await prisma.bid.delete({ where: { id } });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: "bid.override.void",
      entityType: "Bid",
      entityId: id,
      changeSummary: `Voided ${existing.bidder.name}'s ${formatCents(existing.amountCents)} bid.`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin.bid.void.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
