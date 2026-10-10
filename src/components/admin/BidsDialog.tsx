"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { formatCents, dollarsToCents } from "@/lib/money";

type AdminBid = {
  id: string;
  amountCents: number;
  createdAt: string;
  bidderName: string;
  bidderMobile: string;
};

type Bidder = { id: string; name: string; mobile: string };

export function BidsDialog({
  itemId,
  itemTitle,
  onClose,
  onDeclareWinner,
  onChanged,
}: {
  itemId: string | null;
  itemTitle: string;
  onClose: () => void;
  onDeclareWinner: (itemId: string, bidId: string | null) => Promise<void>;
  onChanged: () => void;
}) {
  const [bids, setBids] = useState<AdminBid[]>([]);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [winnerBidId, setWinnerBidId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  // add-bid form state
  const [addBidderId, setAddBidderId] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/items/${itemId}/bids`, { cache: "no-store" });
      const json = await res.json();
      setBids(json.bids ?? []);
      setWinnerBidId(json.item?.winnerBidId ?? null);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (!itemId) return;
    setError(null);
    setEditingId(null);
    setAddBidderId("");
    setAddAmount("");
    void reload();
    fetch("/api/admin/bidders", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setBidders(j.bidders ?? []))
      .catch(() => undefined);
  }, [itemId, reload]);

  // A mutation touched the bids: refresh this dialog AND the parent list so the
  // high-bid/leader columns stay correct.
  const afterChange = useCallback(async () => {
    await reload();
    onChanged();
  }, [reload, onChanged]);

  async function saveEdit(bidId: string) {
    const cents = dollarsToCents(editAmount);
    if (cents === null || cents <= 0) {
      setError("Enter a valid dollar amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bids/${bidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Could not update the bid.");
        return;
      }
      setEditingId(null);
      await afterChange();
    } finally {
      setBusy(false);
    }
  }

  async function voidBid(bidId: string, who: string, amount: number) {
    if (!window.confirm(`Void ${who}'s ${formatCents(amount)} bid? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bids/${bidId}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json()).error ?? "Could not void the bid.");
        return;
      }
      await afterChange();
    } finally {
      setBusy(false);
    }
  }

  async function addBid() {
    if (!itemId) return;
    const cents = dollarsToCents(addAmount);
    if (!addBidderId) return setError("Choose a bidder.");
    if (cents === null || cents <= 0) return setError("Enter a valid dollar amount.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/items/${itemId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidderId: addBidderId, amountCents: cents }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Could not add the bid.");
        return;
      }
      setAddBidderId("");
      setAddAmount("");
      await afterChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(itemId)} onClose={onClose} title={`Bids — ${itemTitle}`}>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {loading && bids.length === 0 ? (
        <p className="text-sm text-navy-soft">Loading…</p>
      ) : bids.length === 0 ? (
        <p className="text-sm text-navy-soft">No bids yet.</p>
      ) : (
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-bg-elevated text-xs uppercase tracking-wide text-navy-soft">
              <tr>
                <th className="py-2">#</th>
                <th className="py-2">Bidder</th>
                <th className="py-2">Mobile</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((b, i) => (
                <tr key={b.id} className="border-t border-hairline align-middle">
                  <td className="py-2 text-navy-soft">{i + 1}</td>
                  <td className="py-2 text-navy">
                    {b.bidderName}
                    {winnerBidId === b.id && (
                      <span className="ml-2 text-xs font-semibold text-gold-deep">Winner</span>
                    )}
                  </td>
                  <td className="py-2 text-navy-soft">
                    <a href={`tel:${b.bidderMobile}`} className="underline">
                      {b.bidderMobile}
                    </a>
                  </td>
                  <td className="py-2 text-right font-semibold text-navy">
                    {editingId === b.id ? (
                      <input
                        autoFocus
                        inputMode="decimal"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-24 rounded border border-hairline px-2 py-1 text-right"
                      />
                    ) : (
                      formatCents(b.amountCents)
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      {editingId === b.id ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            className="font-semibold text-navy underline"
                            onClick={() => saveEdit(b.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-navy-soft underline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {winnerBidId !== b.id && (
                            <button
                              type="button"
                              className="text-navy-soft underline hover:text-navy"
                              onClick={async () => {
                                if (!itemId) return;
                                await onDeclareWinner(itemId, b.id);
                                await reload();
                              }}
                            >
                              Winner
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-navy-soft underline hover:text-navy"
                            onClick={() => {
                              setEditingId(b.id);
                              setEditAmount((b.amountCents / 100).toString());
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="text-danger underline"
                            onClick={() => voidBid(b.id, b.bidderName, b.amountCents)}
                          >
                            Void
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin override: add a bid for a registered guest */}
      <div className="mt-5 rounded-xl border border-hairline bg-bg p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-soft">
          Add a bid manually
        </p>
        {bidders.length === 0 ? (
          <p className="text-xs text-navy-soft">
            No one has registered yet — a guest must register (name + mobile) before you
            can record a bid for them.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <select
              value={addBidderId}
              onChange={(e) => setAddBidderId(e.target.value)}
              className="min-w-40 flex-1 rounded-lg border border-hairline bg-bg-elevated px-3 py-2 text-sm text-navy"
            >
              <option value="">Choose a registered bidder…</option>
              {bidders.map((bd) => (
                <option key={bd.id} value={bd.id}>
                  {bd.name} ({bd.mobile})
                </option>
              ))}
            </select>
            <input
              inputMode="decimal"
              placeholder="Amount"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              className="w-28 rounded-lg border border-hairline bg-bg-elevated px-3 py-2 text-sm text-navy"
            />
            <Button type="button" variant="secondary" disabled={busy} onClick={addBid}>
              Add bid
            </Button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-navy-soft">
          Overrides skip the minimum-increment rule and are recorded in the audit log.
        </p>
      </div>

      <div className="mt-4 flex justify-between gap-3">
        {winnerBidId && itemId && (
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              await onDeclareWinner(itemId, null);
              await reload();
            }}
          >
            Clear winner
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose} className="ml-auto">
          Close
        </Button>
      </div>
    </Dialog>
  );
}
