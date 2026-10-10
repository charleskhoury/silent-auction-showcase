"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicItem } from "@/lib/auction";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCents, dollarsToCents } from "@/lib/money";

export function BidDialog({
  item,
  onClose,
  onPlaced,
}: {
  item: PublicItem | null;
  onClose: () => void;
  onPlaced: (message: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const minNext = item?.minNextBidCents ?? 0;

  // Quick-bid chips: the minimum, then two convenient steps above it.
  const quickBids = useMemo(() => {
    if (!item) return [];
    const inc = item.minIncrementCents;
    return [minNext, minNext + inc, minNext + inc * 4].filter(
      (v, i, arr) => arr.indexOf(v) === i,
    );
  }, [item, minNext]);

  useEffect(() => {
    if (item) {
      setAmount((minNext / 100).toString());
      setError(null);
    }
  }, [item, minNext]);

  if (!item) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setError(null);
    const cents = dollarsToCents(amount);
    if (cents === null) {
      setError("Please enter a valid dollar amount.");
      return;
    }
    if (cents < minNext) {
      setError(`Your bid must be at least ${formatCents(minNext)}.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, amountCents: cents }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not place your bid.");
        return;
      }
      onPlaced(`You're the highest bidder on "${item.title}" at ${formatCents(cents)}.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onClose={onClose} title={`Bid on ${item.title}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="rounded-xl border border-hairline bg-bg p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-navy-soft">Current highest bid</span>
            <span className="font-serif text-lg text-navy">
              {item.highBidCents === null ? "No bids yet" : formatCents(item.highBidCents)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-navy-soft">Minimum next bid</span>
            <span className="font-semibold text-gold-deep">{formatCents(minNext)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickBids.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount((v / 100).toString())}
              className="rounded-full border border-hairline px-4 py-2 text-sm text-navy hover:border-gold-deep hover:bg-white"
            >
              {formatCents(v)}
            </button>
          ))}
        </div>

        <Input
          label="Your bid (AUD)"
          name="amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={error ?? undefined}
          required
        />

        <p className="text-xs text-navy-soft">
          Bids are binding. Winners settle with the committee on the night.
        </p>

        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Placing…" : "Place bid"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
