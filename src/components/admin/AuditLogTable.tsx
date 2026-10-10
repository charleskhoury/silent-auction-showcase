type Entry = {
  id: string;
  administratorEmail: string;
  action: string;
  entityType: string;
  changeSummary: string;
  createdAt: string;
};

export function AuditLogTable({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-navy-soft">No activity recorded yet.</p>;
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-bg text-xs uppercase tracking-wide text-navy-soft">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Admin</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Summary</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-hairline">
              <td className="whitespace-nowrap px-4 py-2 text-xs text-navy-soft">
                {new Date(e.createdAt).toLocaleString("en-AU")}
              </td>
              <td className="px-4 py-2 text-navy-soft">{e.administratorEmail}</td>
              <td className="px-4 py-2 font-mono text-xs text-navy">{e.action}</td>
              <td className="px-4 py-2 text-ink-soft">{e.changeSummary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
