import { prisma } from "@/lib/db";
import { AuditLogTable } from "@/components/admin/AuditLogTable";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl text-navy">Audit log</h1>
      <AuditLogTable
        entries={entries.map((e) => ({
          id: e.id,
          administratorEmail: e.administratorEmail,
          action: e.action,
          entityType: e.entityType,
          changeSummary: e.changeSummary,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
