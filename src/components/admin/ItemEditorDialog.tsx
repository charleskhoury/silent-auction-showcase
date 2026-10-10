"use client";

import { useEffect, useState } from "react";
import type { AdminItem } from "@/lib/adminItems";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { dollarsToCents, formatCents } from "@/lib/money";

export type ItemDraft = {
  title: string;
  description: string;
  startingPrice: string;
  minIncrement: string;
  antiSnipeSeconds: string;
  displayOrder: string;
  closeAtLocal: string; // value for <input type="datetime-local">, or ""
};

function toDraft(item: AdminItem | null): ItemDraft {
  if (!item) {
    return {
      title: "",
      description: "",
      startingPrice: "0",
      minIncrement: "5",
      antiSnipeSeconds: "0",
      displayOrder: "0",
      closeAtLocal: "",
    };
  }
  return {
    title: item.title,
    description: item.description,
    startingPrice: (item.startingPriceCents / 100).toString(),
    minIncrement: (item.minIncrementCents / 100).toString(),
    antiSnipeSeconds: item.antiSnipeSeconds.toString(),
    displayOrder: item.displayOrder.toString(),
    closeAtLocal: item.closeAt ? toLocalInput(item.closeAt) : "",
  };
}

/** ISO -> value accepted by <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ItemEditorDialog({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: AdminItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ItemDraft>(toDraft(item));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(toDraft(item));
      setFile(null);
      setError(null);
    }
  }, [open, item]);

  function set<K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startingPriceCents = dollarsToCents(draft.startingPrice || "0");
    const minIncrementCents = dollarsToCents(draft.minIncrement || "0");
    if (startingPriceCents === null) return setError("Starting price is not a valid amount.");
    if (minIncrementCents === null || minIncrementCents < 100)
      return setError("Minimum increment must be at least $1.");
    if (!draft.title.trim()) return setError("Please enter a title.");

    const payload = {
      title: draft.title.trim(),
      description: draft.description,
      startingPriceCents,
      minIncrementCents,
      antiSnipeSeconds: Number(draft.antiSnipeSeconds) || 0,
      displayOrder: Number(draft.displayOrder) || 0,
      closeAt: draft.closeAtLocal ? new Date(draft.closeAtLocal).toISOString() : null,
    };

    setBusy(true);
    try {
      let itemId = item?.id;
      if (itemId) {
        const res = await fetch(`/api/admin/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setError((await res.json()).error ?? "Could not save.");
          return;
        }
      } else {
        const res = await fetch("/api/admin/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Could not create item.");
          return;
        }
        itemId = json.id as string;
      }

      if (file && itemId) {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(`/api/admin/items/${itemId}/image`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          setError((await res.json()).error ?? "Item saved, but the photo failed to upload.");
          return;
        }
      }

      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={item ? "Edit item" : "Add item"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Title"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-soft" htmlFor="desc">
            Description
          </label>
          <textarea
            id="desc"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            className="rounded-lg border border-hairline bg-bg-elevated px-4 py-2.5 text-navy placeholder:text-navy-soft/50 focus-visible:border-gold-deep"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Starting price (AUD)"
            inputMode="decimal"
            value={draft.startingPrice}
            onChange={(e) => set("startingPrice", e.target.value)}
          />
          <Input
            label="Min increment (AUD)"
            inputMode="decimal"
            value={draft.minIncrement}
            onChange={(e) => set("minIncrement", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Closes at (optional)"
            type="datetime-local"
            value={draft.closeAtLocal}
            onChange={(e) => set("closeAtLocal", e.target.value)}
            hint="Leave blank to close manually."
          />
          <Input
            label="Anti-snipe (seconds)"
            inputMode="numeric"
            value={draft.antiSnipeSeconds}
            onChange={(e) => set("antiSnipeSeconds", e.target.value.replace(/\D/g, ""))}
            hint="Extend deadline on last-minute bids. 0 = off."
          />
        </div>

        <Input
          label="Display order"
          inputMode="numeric"
          value={draft.displayOrder}
          onChange={(e) => set("displayOrder", e.target.value.replace(/\D/g, ""))}
          hint="Lower numbers show first."
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-soft" htmlFor="photo">
            Photo {item?.hasImage && <span className="text-xs">(a new file replaces the current photo)</span>}
          </label>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-navy-soft"
          />
          {item?.hasImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/items/${item.id}/image?v=${item.imageVersion}`}
              alt=""
              className="mt-2 h-40 w-full rounded-lg bg-navy/5 object-contain"
            />
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <p className="text-xs text-navy-soft">
          New items start as a draft (hidden from guests). Open them from the
          items list when you&apos;re ready. Min next bid preview:{" "}
          {formatCents(dollarsToCents(draft.startingPrice || "0") ?? 0)}.
        </p>

        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : item ? "Save changes" : "Create item"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
