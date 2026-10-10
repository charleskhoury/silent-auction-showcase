"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminItem } from "@/lib/adminItems";
import { Button } from "@/components/ui/Button";
import { ItemEditorDialog } from "@/components/admin/ItemEditorDialog";
import { BidsDialog } from "@/components/admin/BidsDialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { formatCents } from "@/lib/money";

const STATUS_LABEL: Record<AdminItem["status"], string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
};

export function ItemsManager() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [bidsFor, setBidsFor] = useState<AdminItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/items", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setItems((await res.json()).items ?? []);
      setError(null);
    } catch {
      setError("Could not load items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 5000); // keep live so the committee sees bids roll in
    return () => clearInterval(id);
  }, [load]);

  const patchStatus = useCallback(
    async (item: AdminItem, status: AdminItem["status"]) => {
      await fetch(`/api/admin/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    },
    [load],
  );

  const declareWinner = useCallback(
    async (itemId: string, bidId: string | null) => {
      await fetch(`/api/admin/items/${itemId}/winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId }),
      });
      await load();
    },
    [load],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-navy">Auction items</h1>
        <div className="flex gap-3">
          <a href="/api/admin/export" className="inline-flex">
            <Button variant="secondary">Export bids (CSV)</Button>
          </a>
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            Add item
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-navy-soft">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-navy-soft">
          No items yet. Add the two auction items to get started.
        </p>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-navy/5">
                {item.hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/items/${item.id}/image?v=${item.imageVersion}`}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-navy-soft">
                    No photo
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl text-navy">{item.title}</h2>
                  <StatusBadge status={item.status} />
                  {item.closeAt && (
                    <span className="text-xs text-navy-soft">
                      closes {new Date(item.closeAt).toLocaleString("en-AU")}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-navy-soft">
                  <span>
                    High:{" "}
                    <span className="font-semibold text-navy">
                      {item.highBidCents === null ? "—" : formatCents(item.highBidCents)}
                    </span>
                  </span>
                  <span>{item.bidCount} bids</span>
                  <span>start {formatCents(item.startingPriceCents)}</span>
                  <span>+{formatCents(item.minIncrementCents)} min</span>
                  {item.leaderName && <span>leading: {item.leaderName}</span>}
                </div>
                {item.winner && (
                  <p className="mt-2 rounded-lg bg-gold/10 px-3 py-1.5 text-sm text-gold-deep">
                    Winner: {item.winner.name} · {item.winner.mobile} · {formatCents(item.winner.amountCents)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                {item.status === "DRAFT" && (
                  <Button variant="secondary" onClick={() => patchStatus(item, "OPEN")}>
                    Open
                  </Button>
                )}
                {item.status === "OPEN" && (
                  <Button variant="secondary" onClick={() => patchStatus(item, "CLOSED")}>
                    Close
                  </Button>
                )}
                {item.status === "CLOSED" && (
                  <Button variant="secondary" onClick={() => patchStatus(item, "OPEN")}>
                    Reopen
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setBidsFor(item)}>
                  Bids ({item.bidCount})
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(item);
                    setEditorOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(item)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ItemEditorDialog
        open={editorOpen}
        item={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          void load();
        }}
      />

      <BidsDialog
        itemId={bidsFor?.id ?? null}
        itemTitle={bidsFor?.title ?? ""}
        onClose={() => setBidsFor(null)}
        onDeclareWinner={declareWinner}
        onChanged={load}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete item?"
        message={`This permanently deletes "${confirmDelete?.title ?? ""}" and all of its bids. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await fetch(`/api/admin/items/${confirmDelete.id}`, { method: "DELETE" });
          }
          setConfirmDelete(null);
          void load();
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: AdminItem["status"] }) {
  const styles: Record<AdminItem["status"], string> = {
    DRAFT: "bg-navy/10 text-navy",
    OPEN: "bg-gold/15 text-gold-deep",
    CLOSED: "bg-ink/10 text-ink-soft",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
