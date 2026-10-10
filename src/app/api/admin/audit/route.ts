import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      administratorEmail: e.administratorEmail,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      changeSummary: e.changeSummary,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
