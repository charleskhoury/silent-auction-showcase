import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond, safeError } from "@/lib/apiAuth";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const existing = await prisma.item.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Please upload a JPEG, PNG or WebP image." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large (max 6 MB)." },
      { status: 400 },
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await prisma.item.update({
      where: { id },
      data: { imageData: bytes, imageType: file.type },
    });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: "item.image.set",
      entityType: "Item",
      entityId: id,
      changeSummary: `Uploaded a photo (${file.type}, ${Math.round(file.size / 1024)} KB).`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin.item.image.failed");
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
    await prisma.item.update({
      where: { id },
      data: { imageData: null, imageType: null },
    });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: "item.image.remove",
      entityType: "Item",
      entityId: id,
      changeSummary: "Removed the item photo.",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin.item.image.remove.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
