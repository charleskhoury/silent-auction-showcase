"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicItem } from "@/lib/auction";
import { VenueBackdrop } from "@/components/public/VenueBackdrop";
import { EmblemMotif } from "@/components/public/EmblemMotif";
import { Ornament } from "@/components/public/Ornament";
import { ItemCard } from "@/components/public/ItemCard";
import { RegisterDialog, type Bidder } from "@/components/public/RegisterDialog";
import { BidDialog } from "@/components/public/BidDialog";

type PublicData = {
  eventName: string;
  biddingEnabled: boolean;
  closedMessage: string | null;
  items: PublicItem[];
};

const POLL_MS = 3000;

export function AuctionBoard({
  initialData,
  initialBidder,
}: {
  initialData: PublicData;
  initialBidder: Bidder | null;
}) {
  const [data, setData] = useState<PublicData>(initialData);
  const [bidder, setBidder] = useState<Bidder | null>(initialBidder);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [bidItemId, setBidItemId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // When a guest taps "bid" before registering, remember which item so we can
  // open the bid dialog straight after they register.
  const pendingItemId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/items", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // transient network blip — the next tick will retry
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleBid = useCallback(
    (item: PublicItem) => {
      if (!bidder) {
        pendingItemId.current = item.id;
        setRegisterOpen(true);
        return;
      }
      setBidItemId(item.id);
    },
    [bidder],
  );

  const handleRegistered = useCallback(
    (b: Bidder, returning: boolean) => {
      setBidder(b);
      setRegisterOpen(false);
      setToast(returning ? `Welcome back, ${b.name.split(" ")[0]}.` : `You're registered, ${b.name.split(" ")[0]}.`);
      void refresh();
      if (pendingItemId.current) {
        const id = pendingItemId.current;
        pendingItemId.current = null;
        setBidItemId(id);
      }
    },
    [refresh],
  );

  const bidItem = bidItemId ? data.items.find((i) => i.id === bidItemId) ?? null : null;

  return (
    <>
      <VenueBackdrop />
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-10 sm:px-6">
        <header className="flex flex-col items-center text-center">
          <EmblemMotif className="h-12 w-9 text-gold-deep" />
          <p className="eyebrow mt-4">{data.eventName}</p>
          <h1 className="mt-2 font-serif text-4xl text-navy sm:text-5xl">Silent Auction</h1>
          <Ornament className="mt-4" />
          <figure className="mt-5 max-w-md">
            <blockquote className="font-serif text-lg italic leading-relaxed text-navy">
              &ldquo;Every bid supports a good cause.&rdquo;
            </blockquote>
            <figcaption className="eyebrow mt-2">Thank you for your generosity</figcaption>
          </figure>
          {bidder && (
            <p className="mt-3 text-xs text-navy-soft">
              Bidding as <span className="font-semibold">{bidder.name}</span>
              {bidder.anonymous && " (shown as Anonymous)"} ·{" "}
              <button
                type="button"
                className="underline hover:text-navy"
                onClick={async () => {
                  await fetch("/api/bidder", { method: "DELETE" });
                  setBidder(null);
                  void refresh();
                }}
              >
                not you?
              </button>
            </p>
          )}
        </header>

        {!data.biddingEnabled && (
          <p className="mt-8 rounded-xl border border-hairline bg-white px-4 py-3 text-center text-sm text-navy">
            {data.closedMessage ?? "Bidding is not open at the moment."}
          </p>
        )}

        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          {data.items.length === 0 ? (
            <p className="col-span-full text-center text-sm text-navy-soft">
              The auction items will appear here soon.
            </p>
          ) : (
            data.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                biddingEnabled={data.biddingEnabled}
                onBid={handleBid}
              />
            ))
          )}
        </section>

        <footer className="mt-auto pt-12 text-center text-xs text-navy-soft">
          <Ornament className="mx-auto mb-3" />
          Riverside Community Foundation
        </footer>
      </main>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-full bg-navy px-5 py-3 text-center text-sm text-white shadow-soft"
        >
          {toast}
        </div>
      )}

      <RegisterDialog
        open={registerOpen}
        onClose={() => {
          setRegisterOpen(false);
          pendingItemId.current = null;
        }}
        onRegistered={handleRegistered}
      />

      <BidDialog
        item={bidItem}
        onClose={() => setBidItemId(null)}
        onPlaced={(message) => {
          setBidItemId(null);
          setToast(message);
          void refresh();
        }}
      />
    </>
  );
}
