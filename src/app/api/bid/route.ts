import { NextRequest, NextResponse } from "next/server";
import { placeBid, BidError } from "@/lib/auction";
import { placeBidSchema } from "@/lib/validation";
import { getBidderId } from "@/lib/bidderSession";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { safeError } from "@/lib/apiAuth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const bidderId = await getBidderId();
  if (!bidderId) {
    return NextResponse.json(
      { error: "Please register before bidding.", code: "NO_SESSION" },
      { status: 401 },
    );
  }

  const ip = getClientIp(req.headers);
  if (!checkRateLimit(`bid:${bidderId}`, 30, 60_000).allowed) {
    return NextResponse.json(
      { error: "You're bidding very fast — please wait a moment.", code: "RATE" },
      { status: 429 },
    );
  }
  // Second, coarser limit by IP in case many bidders share one phone/hotspot
  // but also to blunt a scripted flood from one source.
  checkRateLimit(`bid-ip:${ip}`, 120, 60_000);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = placeBidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid bid." },
      { status: 400 },
    );
  }

  try {
    const result = await placeBid({
      itemId: parsed.data.itemId,
      bidderId,
      amountCents: parsed.data.amountCents,
    });
    return NextResponse.json({
      ok: true,
      bidId: result.bidId,
      amountCents: result.amountCents,
      closeAt: result.newCloseAt ? result.newCloseAt.toISOString() : null,
    });
  } catch (err) {
    if (err instanceof BidError) {
      const status = err.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json(
        { error: err.message, code: err.code, minNextBidCents: err.minNextCents },
        { status },
      );
    }
    logger.error({ err }, "bid.place.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
