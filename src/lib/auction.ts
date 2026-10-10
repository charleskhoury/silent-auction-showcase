import { prisma } from "@/lib/db";
import type { Item, SiteSettings } from "@prisma/client";

export const SETTINGS_ID = 1;

/** Ensure the singleton settings row exists, then return it. */
export async function getSettings(): Promise<SiteSettings> {
  return prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

/** Show a leaderboard identity without leaking a full surname or mobile. */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return `${first} ${lastInitial}.`;
}

/** Public-facing bidder label: "Anonymous" if they opted out, else masked. */
export function publicBidderLabel(bidder: { name: string; anonymous: boolean }): string {
  return bidder.anonymous ? "Anonymous" : maskName(bidder.name);
}

export function minNextBidCents(item: Pick<Item, "startingPriceCents" | "minIncrementCents">, highCents: number | null): number {
  if (highCents === null) return item.startingPriceCents;
  return highCents + item.minIncrementCents;
}

/**
 * Bidding is open for an item only when: the master switch is on, the item is
 * OPEN, and (if a soft deadline is set) that deadline has not passed.
 */
export function isBiddingOpen(
  item: Pick<Item, "status" | "closeAt">,
  settings: Pick<SiteSettings, "biddingEnabled">,
  now: Date = new Date(),
): boolean {
  if (!settings.biddingEnabled) return false;
  if (item.status !== "OPEN") return false;
  if (item.closeAt && item.closeAt.getTime() <= now.getTime()) return false;
  return true;
}

export class BidError extends Error {
  code: "NOT_FOUND" | "CLOSED" | "TOO_LOW" | "SELF_OUTBID";
  minNextCents?: number;
  constructor(code: BidError["code"], message: string, minNextCents?: number) {
    super(message);
    this.code = code;
    this.minNextCents = minNextCents;
  }
}

export type PlaceBidResult = {
  bidId: string;
  amountCents: number;
  itemId: string;
  newCloseAt: Date | null;
};

/**
 * Place a bid atomically. The Item row is locked FOR UPDATE for the duration
 * of the transaction, so two guests bidding on the same item at the same
 * instant are serialised: the second one reads the first one's bid as the
 * current high and is validated against it. Without the lock, both could read
 * the same stale high and tie.
 */
export async function placeBid(params: {
  itemId: string;
  bidderId: string;
  amountCents: number;
}): Promise<PlaceBidResult> {
  const { itemId, bidderId, amountCents } = params;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Serialise concurrent bids on this item.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Item" WHERE id = ${itemId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new BidError("NOT_FOUND", "That item no longer exists.");
    }

    const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
    const settings = await tx.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });

    if (!isBiddingOpen(item, settings, now)) {
      throw new BidError("CLOSED", "Bidding for this item is closed.");
    }

    const top = await tx.bid.findFirst({
      where: { itemId },
      orderBy: [{ amountCents: "desc" }, { createdAt: "asc" }],
      select: { amountCents: true, bidderId: true },
    });

    const highCents = top?.amountCents ?? null;
    const minNext = minNextBidCents(item, highCents);

    if (top && top.bidderId === bidderId) {
      // Already winning — block a pointless raise-against-self unless they are
      // explicitly outbidding a higher required amount (they aren't, since
      // they hold the high bid). Keeps the leaderboard honest.
      throw new BidError("SELF_OUTBID", "You are already the highest bidder on this item.", minNext);
    }

    if (amountCents < minNext) {
      throw new BidError("TOO_LOW", `Your bid must be at least ${minNext} cents.`, minNext);
    }

    const bid = await tx.bid.create({
      data: { itemId, bidderId, amountCents },
      select: { id: true },
    });

    // Anti-snipe: a valid bid inside the final window pushes the deadline out,
    // so a last-second bid can always be answered.
    let newCloseAt: Date | null = item.closeAt;
    if (item.closeAt && item.antiSnipeSeconds > 0) {
      const remainingMs = item.closeAt.getTime() - now.getTime();
      if (remainingMs > 0 && remainingMs < item.antiSnipeSeconds * 1000) {
        newCloseAt = new Date(now.getTime() + item.antiSnipeSeconds * 1000);
        await tx.item.update({ where: { id: itemId }, data: { closeAt: newCloseAt } });
      }
    }

    return { bidId: bid.id, amountCents, itemId, newCloseAt };
  });
}

/** Scalar item fields safe to select for lists (never the image bytes). */
const PUBLIC_ITEM_SELECT = {
  id: true,
  title: true,
  description: true,
  imageType: true,
  startingPriceCents: true,
  minIncrementCents: true,
  status: true,
  closeAt: true,
  antiSnipeSeconds: true,
  winnerBidId: true,
  updatedAt: true,
} as const;

export type PublicItem = {
  id: string;
  title: string;
  description: string;
  hasImage: boolean;
  imageVersion: number;
  startingPriceCents: number;
  minIncrementCents: number;
  status: "DRAFT" | "OPEN" | "CLOSED";
  closeAt: string | null;
  highBidCents: number | null;
  bidCount: number;
  leaderName: string | null;
  minNextBidCents: number;
  biddingOpen: boolean;
  you: { isHighBidder: boolean; yourHighBidCents: number | null } | null;
  winner: { name: string; amountCents: number } | null;
};

/**
 * Build the public view of every visible item (DRAFT items are hidden). If a
 * bidderId is supplied, per-item "you" status is included.
 */
export async function listPublicItems(bidderId: string | null): Promise<{
  eventName: string;
  biddingEnabled: boolean;
  closedMessage: string | null;
  items: PublicItem[];
}> {
  const settings = await getSettings();
  const now = new Date();

  const items = await prisma.item.findMany({
    where: { status: { in: ["OPEN", "CLOSED"] } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: PUBLIC_ITEM_SELECT,
  });

  const result: PublicItem[] = [];
  for (const item of items) {
    const [top, bidCount, yourBid, winnerBid] = await Promise.all([
      prisma.bid.findFirst({
        where: { itemId: item.id },
        orderBy: [{ amountCents: "desc" }, { createdAt: "asc" }],
        select: {
          amountCents: true,
          bidderId: true,
          bidder: { select: { name: true, anonymous: true } },
        },
      }),
      prisma.bid.count({ where: { itemId: item.id } }),
      bidderId
        ? prisma.bid.findFirst({
            where: { itemId: item.id, bidderId },
            orderBy: { amountCents: "desc" },
            select: { amountCents: true },
          })
        : Promise.resolve(null),
      item.winnerBidId
        ? prisma.bid.findUnique({
            where: { id: item.winnerBidId },
            select: {
              amountCents: true,
              bidder: { select: { name: true, anonymous: true } },
            },
          })
        : Promise.resolve(null),
    ]);

    const highCents = top?.amountCents ?? null;

    result.push({
      id: item.id,
      title: item.title,
      description: item.description,
      hasImage: Boolean(item.imageType),
      imageVersion: item.updatedAt.getTime(),
      startingPriceCents: item.startingPriceCents,
      minIncrementCents: item.minIncrementCents,
      status: item.status,
      closeAt: item.closeAt ? item.closeAt.toISOString() : null,
      highBidCents: highCents,
      bidCount,
      leaderName: top ? publicBidderLabel(top.bidder) : null,
      minNextBidCents: minNextBidCents(item, highCents),
      biddingOpen: isBiddingOpen(item, settings, now),
      you: bidderId
        ? {
            isHighBidder: Boolean(top && top.bidderId === bidderId),
            yourHighBidCents: yourBid?.amountCents ?? null,
          }
        : null,
      winner: winnerBid
        ? { name: publicBidderLabel(winnerBid.bidder), amountCents: winnerBid.amountCents }
        : null,
    });
  }

  return {
    eventName: settings.eventName,
    biddingEnabled: settings.biddingEnabled,
    closedMessage: settings.closedMessage,
    items: result,
  };
}
