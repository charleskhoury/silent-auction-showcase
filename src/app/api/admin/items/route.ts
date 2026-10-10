import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond, safeError } from "@/lib/apiAuth";
import { itemCreateSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { serializeAdminItems } from "@/lib/adminItems";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const items = await serializeAdminItems();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = itemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid item." },
      { status: 400 },
    );
  }

  try {
    const { closeAt, ...rest } = parsed.data;
    const item = await prisma.item.create({
      data: { ...rest, closeAt: closeAt ?? null },
      select: { id: true, title: true },
    });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: "item.create",
      entityType: "Item",
      entityId: item.id,
      changeSummary: `Created item "${item.title}".`,
    });
    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "admin.item.create.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
