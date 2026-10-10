"use client";

import type { PublicItem } from "@/lib/auction";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/public/Countdown";
import { formatCents } from "@/lib/money";

export function ItemCard({
  item,
  biddingEnabled,
  onBid,
}: {
  item: PublicItem;
  biddingEnabled: boolean;
  onBid: (item: PublicItem) => void;
}) {
  const youAreHigh = item.you?.isHighBidder;

  return (
    <article className="card flex flex-col overflow-hidden">
      {item.hasImage ? (
        // object-contain (not cover) so portrait and landscape photos both show
        // in full without cropping; the tinted box letterboxes the difference.
        // Plain <img> (not next/image) because the source is our own dynamic
        // /api route, cache-busted by the item's updatedAt version.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/items/${item.id}/image?v=${item.imageVersion}`}
          alt={item.title}
          className="h-72 w-full bg-navy/5 object-contain p-2 sm:h-80"
        />
      ) : (
        <div className="flex h-72 w-full items-center justify-center bg-navy/5 sm:h-80">
          <span className="eyebrow">Riverside Community Gala</span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl text-navy">{item.title}</h2>
            {item.status === "CLOSED" ? (
              <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-navy">
                Closed
              </span>
            ) : item.biddingOpen ? (
              <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-deep">
                Open
              </span>
            ) : null}
          </div>
          {item.description && (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-auto rounded-xl border border-hairline bg-bg p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">
                {item.status === "CLOSED" ? "Winning bid" : "Current highest bid"}
              </p>
              <p className="font-serif text-3xl text-navy">
                {item.highBidCents === null ? "No bids yet" : formatCents(item.highBidCents)}
              </p>
            </div>
            <div className="text-right text-xs text-navy-soft">
              <p>{item.bidCount} {item.bidCount === 1 ? "bid" : "bids"}</p>
              {item.leaderName && <p className="mt-1">Leading: {item.leaderName}</p>}
              {item.closeAt && item.status !== "CLOSED" && (
                <p className="mt-1">
                  <Countdown closeAt={item.closeAt} />
                </p>
              )}
            </div>
          </div>

          {item.status !== "CLOSED" && (
            <p className="mt-2 text-xs text-navy-soft">
              Next bid from <span className="font-semibold">{formatCents(item.minNextBidCents)}</span>
            </p>
          )}
        </div>

        {youAreHigh && item.status !== "CLOSED" && (
          <p className="rounded-lg bg-gold/10 px-3 py-2 text-center text-sm font-medium text-gold-deep">
            ✓ You&apos;re the highest bidder
          </p>
        )}
        {item.you && !youAreHigh && item.you.yourHighBidCents !== null && item.status !== "CLOSED" && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-center text-sm font-medium text-danger">
            You&apos;ve been outbid (your bid: {formatCents(item.you.yourHighBidCents)})
          </p>
        )}

        {item.status === "CLOSED" ? (
          <p className="text-center text-sm text-navy-soft">
            {youAreHigh
              ? "You won this item — the committee will be in touch to settle."
              : item.winner
                ? `Won by ${item.winner.name}.`
                : "Bidding has closed."}
          </p>
        ) : youAreHigh ? (
          // No raise-against-self: you already hold the top bid. Someone else
          // must outbid you first (the live view will tell you when they do).
          <p className="text-center text-xs text-navy-soft">
            Sit tight — you&apos;ll see here if someone outbids you.
          </p>
        ) : (
          <Button
            onClick={() => onBid(item)}
            disabled={!biddingEnabled || !item.biddingOpen}
            className="w-full"
          >
            Place a bid
          </Button>
        )}
      </div>
    </article>
  );
}
