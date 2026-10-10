import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond, safeError } from "@/lib/apiAuth";
import { settingsUpdateSchema } from "@/lib/validation";
import { getSettings, SETTINGS_ID } from "@/lib/auction";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings." },
      { status: 400 },
    );
  }

  try {
    await getSettings(); // ensure the row exists
    const settings = await prisma.siteSettings.update({
      where: { id: SETTINGS_ID },
      data: { ...parsed.data, updatedBy: gate.email },
    });
    await writeAuditLog({
      administratorEmail: gate.email,
      action: "settings.update",
      entityType: "SiteSettings",
      entityId: String(SETTINGS_ID),
      changeSummary: `Updated settings (${Object.keys(parsed.data).join(", ")}).`,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    logger.error({ err }, "admin.settings.update.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
