import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond, safeError } from "@/lib/apiAuth";
import { itemUpdateSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { serializeAdminItem } from "@/lib/adminItems";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const item = await serializeAdminItem(id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ item });
}

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

  const parsed = itemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid item." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.item.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    // Only set fields that were actually provided (partial update).
    const data = parsed.data;
    const update: Record<string, unknown> = {};
    for (const key of [
      "title",
      "description",
      "startingPriceCents",
      "minIncrementCents",
      "antiSnipeSeconds",
      "displayOrder",
      "status",
    ] as const) {
      if (data[key] !== undefined) update[key] = data[key];
    }
    // closeAt is absent -> undefined (leave unchanged); present (date, "" or
    // null) -> the schema transform already coerced it to Date | null.
    if (data.closeAt !== undefined) {
      update.closeAt = data.closeAt;
    }

    await prisma.item.update({ where: { id }, data: update });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: "item.update",
      entityType: "Item",
      entityId: id,
      changeSummary: `Updated item (${Object.keys(update).join(", ") || "no-op"}).`,
    });

    const item = await serializeAdminItem(id);
    return NextResponse.json({ item });
  } catch (err) {
    logger.error({ err }, "admin.item.update.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  try {
    const item = await prisma.item.findUnique({ where: { id }, select: { title: true } });
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

    // A winnerBidId FK points into this item's own bids; null it first so the
    // cascade delete of bids doesn't trip the self-referential constraint.
    await prisma.item.update({ where: { id }, data: { winnerBidId: null } });
    await prisma.item.delete({ where: { id } });

    await writeAuditLog({
      administratorEmail: gate.email,
      action: "item.delete",
      entityType: "Item",
      entityId: id,
      changeSummary: `Deleted item "${item.title}" and all its bids.`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin.item.delete.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
