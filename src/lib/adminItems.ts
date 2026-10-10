import { prisma } from "@/lib/db";
import { getSettings, isBiddingOpen, minNextBidCents } from "@/lib/auction";

export type AdminItem = {
  id: string;
  title: string;
  description: string;
  hasImage: boolean;
  imageVersion: number;
  startingPriceCents: number;
  minIncrementCents: number;
  minNextBidCents: number;
  status: "DRAFT" | "OPEN" | "CLOSED";
  closeAt: string | null;
  antiSnipeSeconds: number;
  displayOrder: number;
  highBidCents: number | null;
  bidCount: number;
  leaderName: string | null;
  winnerBidId: string | null;
  winner: { name: string; mobile: string; amountCents: number } | null;
  biddingOpen: boolean;
  createdAt: string;
};

const SELECT = {
  id: true,
  title: true,
  description: true,
  imageType: true,
  startingPriceCents: true,
  minIncrementCents: true,
  status: true,
  closeAt: true,
  antiSnipeSeconds: true,
  displayOrder: true,
  winnerBidId: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function build(item: {
  id: string;
  title: string;
  description: string;
  imageType: string | null;
  startingPriceCents: number;
  minIncrementCents: number;
  status: "DRAFT" | "OPEN" | "CLOSED";
  closeAt: Date | null;
  antiSnipeSeconds: number;
  displayOrder: number;
  winnerBidId: string | null;
  createdAt: Date;
  updatedAt: Date;
}, biddingEnabled: boolean, now: Date): Promise<AdminItem> {
  const [top, bidCount, winnerBid] = await Promise.all([
    prisma.bid.findFirst({
      where: { itemId: item.id },
      orderBy: [{ amountCents: "desc" }, { createdAt: "asc" }],
      select: { amountCents: true, bidder: { select: { name: true } } },
    }),
    prisma.bid.count({ where: { itemId: item.id } }),
    item.winnerBidId
      ? prisma.bid.findUnique({
          where: { id: item.winnerBidId },
          select: { amountCents: true, bidder: { select: { name: true, mobile: true } } },
        })
      : Promise.resolve(null),
  ]);

  const highCents = top?.amountCents ?? null;

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    hasImage: Boolean(item.imageType),
    imageVersion: item.updatedAt.getTime(),
    startingPriceCents: item.startingPriceCents,
    minIncrementCents: item.minIncrementCents,
    minNextBidCents: minNextBidCents(item, highCents),
    status: item.status,
    closeAt: item.closeAt ? item.closeAt.toISOString() : null,
    antiSnipeSeconds: item.antiSnipeSeconds,
    displayOrder: item.displayOrder,
    highBidCents: highCents,
    bidCount,
    leaderName: top?.bidder.name ?? null,
    winnerBidId: item.winnerBidId,
    winner: winnerBid
      ? {
          name: winnerBid.bidder.name,
          mobile: winnerBid.bidder.mobile,
          amountCents: winnerBid.amountCents,
        }
      : null,
    biddingOpen: isBiddingOpen(item, { biddingEnabled }, now),
    createdAt: item.createdAt.toISOString(),
  };
}

export async function serializeAdminItems(): Promise<AdminItem[]> {
  const settings = await getSettings();
  const now = new Date();
  const items = await prisma.item.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: SELECT,
  });
  return Promise.all(items.map((i) => build(i, settings.biddingEnabled, now)));
}

export async function serializeAdminItem(id: string): Promise<AdminItem | null> {
  const settings = await getSettings();
  const item = await prisma.item.findUnique({ where: { id }, select: SELECT });
  if (!item) return null;
  return build(item, settings.biddingEnabled, new Date());
}
