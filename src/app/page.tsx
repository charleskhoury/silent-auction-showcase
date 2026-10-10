import { listPublicItems } from "@/lib/auction";
import { getBidderId } from "@/lib/bidderSession";
import { prisma } from "@/lib/db";
import { AuctionBoard } from "@/components/public/AuctionBoard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const bidderId = await getBidderId();
  const [data, bidder] = await Promise.all([
    listPublicItems(bidderId),
    bidderId
      ? prisma.bidder.findUnique({
          where: { id: bidderId },
          select: { id: true, name: true, mobile: true, anonymous: true },
        })
      : Promise.resolve(null),
  ]);

  return <AuctionBoard initialData={data} initialBidder={bidder} />;
}
