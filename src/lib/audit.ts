import { prisma } from "@/lib/db";

export async function writeAuditLog(entry: {
  administratorEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  changeSummary: string;
}) {
  await prisma.auditLog.create({
    data: {
      administratorEmail: entry.administratorEmail,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      changeSummary: entry.changeSummary,
    },
  });
}
