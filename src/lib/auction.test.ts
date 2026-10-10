import { describe, it, expect, vi, beforeEach } from "vitest";

// Shared, hoisted holder for the per-test transaction mock. placeBid runs its
// work inside prisma.$transaction(cb); we make that call cb(txRef.current).
const { txRef } = vi.hoisted(() => ({ txRef: { current: null as unknown as TxMock } }));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: async (cb: (tx: TxMock) => unknown) => cb(txRef.current),
  },
}));

import {
  minNextBidCents,
  isBiddingOpen,
  maskName,
  publicBidderLabel,
  placeBid,
  BidError,
} from "@/lib/auction";

// ---- pure helpers -------------------------------------------------------

describe("minNextBidCents", () => {
  const item = { startingPriceCents: 1000, minIncrementCents: 500 };

  it("is the starting price when there are no bids yet", () => {
    expect(minNextBidCents(item, null)).toBe(1000);
  });

  it("is the current high plus the increment once bidding has started", () => {
    expect(minNextBidCents(item, 2000)).toBe(2500);
  });
});

describe("isBiddingOpen", () => {
  const now = new Date("2026-10-10T10:00:00Z");

  it("is open for an OPEN item with the master switch on and no deadline", () => {
    expect(isBiddingOpen({ status: "OPEN", closeAt: null }, { biddingEnabled: true }, now)).toBe(true);
  });

  it("is closed when the master switch is off", () => {
    expect(isBiddingOpen({ status: "OPEN", closeAt: null }, { biddingEnabled: false }, now)).toBe(false);
  });

  it("is closed when the item is not OPEN", () => {
    expect(isBiddingOpen({ status: "DRAFT", closeAt: null }, { biddingEnabled: true }, now)).toBe(false);
    expect(isBiddingOpen({ status: "CLOSED", closeAt: null }, { biddingEnabled: true }, now)).toBe(false);
  });

  it("is closed once a soft deadline has passed, open before it", () => {
    const past = new Date(now.getTime() - 1000);
    const future = new Date(now.getTime() + 1000);
    expect(isBiddingOpen({ status: "OPEN", closeAt: past }, { biddingEnabled: true }, now)).toBe(false);
    expect(isBiddingOpen({ status: "OPEN", closeAt: future }, { biddingEnabled: true }, now)).toBe(true);
  });
});

describe("maskName / publicBidderLabel", () => {
  it("keeps a single name whole but reduces a surname to an initial", () => {
    expect(maskName("Alex")).toBe("Alex");
    expect(maskName("Alex Taylor")).toBe("Alex T.");
    expect(maskName("Maria del Carmen Ruiz")).toBe("Maria R.");
  });

  it("shows Anonymous when the bidder opted out, else the masked name", () => {
    expect(publicBidderLabel({ name: "Alex Taylor", anonymous: false })).toBe("Alex T.");
    expect(publicBidderLabel({ name: "Alex Taylor", anonymous: true })).toBe("Anonymous");
  });
});

// ---- placeBid (transactional bid rules) ---------------------------------

type TxMock = {
  $queryRaw: ReturnType<typeof vi.fn>;
  item: { findUniqueOrThrow: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  siteSettings: { upsert: ReturnType<typeof vi.fn> };
  bid: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

type ItemShape = {
  id: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  closeAt: Date | null;
  antiSnipeSeconds: number;
  startingPriceCents: number;
  minIncrementCents: number;
};

function makeTx(opts: {
  item: ItemShape;
  biddingEnabled?: boolean;
  top?: { amountCents: number; bidderId: string } | null;
  locked?: { id: string }[];
}): TxMock {
  return {
    $queryRaw: vi.fn().mockResolvedValue(opts.locked ?? [{ id: opts.item.id }]),
    item: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(opts.item),
      update: vi.fn().mockResolvedValue({}),
    },
    siteSettings: {
      upsert: vi.fn().mockResolvedValue({ biddingEnabled: opts.biddingEnabled ?? true }),
    },
    bid: {
      findFirst: vi.fn().mockResolvedValue(opts.top ?? null),
      create: vi.fn().mockResolvedValue({ id: "bid_new" }),
    },
  };
}

const openItem: ItemShape = {
  id: "item1",
  status: "OPEN",
  closeAt: null,
  antiSnipeSeconds: 0,
  startingPriceCents: 1000,
  minIncrementCents: 500,
};

beforeEach(() => {
  txRef.current = makeTx({ item: openItem });
});

describe("placeBid", () => {
  it("accepts a first bid at the starting price", async () => {
    const result = await placeBid({ itemId: "item1", bidderId: "me", amountCents: 1000 });
    expect(result).toMatchObject({ bidId: "bid_new", amountCents: 1000, itemId: "item1", newCloseAt: null });
    expect(txRef.current.bid.create).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when the item row cannot be locked", async () => {
    txRef.current = makeTx({ item: openItem, locked: [] });
    await expect(placeBid({ itemId: "item1", bidderId: "me", amountCents: 1000 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws CLOSED when the master switch is off", async () => {
    txRef.current = makeTx({ item: openItem, biddingEnabled: false });
    await expect(placeBid({ itemId: "item1", bidderId: "me", amountCents: 1000 })).rejects.toMatchObject({
      code: "CLOSED",
    });
  });

  it("throws CLOSED when the item is not OPEN", async () => {
    txRef.current = makeTx({ item: { ...openItem, status: "DRAFT" } });
    await expect(placeBid({ itemId: "item1", bidderId: "me", amountCents: 1000 })).rejects.toMatchObject({
      code: "CLOSED",
    });
  });

  it("throws TOO_LOW (with the required minimum) when the bid is under the increment", async () => {
    txRef.current = makeTx({ item: openItem, top: { amountCents: 2000, bidderId: "other" } });
    const err = await placeBid({ itemId: "item1", bidderId: "me", amountCents: 2400 }).catch((e) => e);
    expect(err).toBeInstanceOf(BidError);
    expect(err).toMatchObject({ code: "TOO_LOW", minNextCents: 2500 });
    expect(txRef.current.bid.create).not.toHaveBeenCalled();
  });

  it("blocks raising against yourself (SELF_OUTBID)", async () => {
    txRef.current = makeTx({ item: openItem, top: { amountCents: 2000, bidderId: "me" } });
    await expect(placeBid({ itemId: "item1", bidderId: "me", amountCents: 3000 })).rejects.toMatchObject({
      code: "SELF_OUTBID",
    });
  });

  it("extends the deadline (anti-snipe) for a valid last-moment bid", async () => {
    const closeAt = new Date(Date.now() + 10_000); // 10s away
    txRef.current = makeTx({ item: { ...openItem, closeAt, antiSnipeSeconds: 30 } });
    const result = await placeBid({ itemId: "item1", bidderId: "me", amountCents: 1000 });
    expect(txRef.current.item.update).toHaveBeenCalledOnce();
    expect(result.newCloseAt).toBeInstanceOf(Date);
    expect(result.newCloseAt!.getTime()).toBeGreaterThan(closeAt.getTime());
  });
});
