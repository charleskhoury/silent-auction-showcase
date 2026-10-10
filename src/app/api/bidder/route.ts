import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { bidderAuthSchema } from "@/lib/validation";
import { normaliseMobile } from "@/lib/money";
import {
  getBidderId,
  setBidderCookie,
  clearBidderCookie,
} from "@/lib/bidderSession";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { safeError } from "@/lib/apiAuth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Current bidder (self view) from the signed cookie. */
export async function GET() {
  const bidderId = await getBidderId();
  if (!bidderId) return NextResponse.json({ bidder: null });
  const bidder = await prisma.bidder.findUnique({
    where: { id: bidderId },
    select: { id: true, name: true, mobile: true, anonymous: true },
  });
  return NextResponse.json({ bidder });
}

/**
 * Register (first time) or reclaim (returning on a new device).
 * - mobile unseen  -> create a Bidder with a hashed PIN, sign them in.
 * - mobile seen    -> require the matching PIN, then sign them in.
 * The two paths are intentionally the same form so a guest never has to think
 * about whether they are "new" or "returning".
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  // Throttle PIN attempts per IP so a shared mobile+PIN can't be brute forced.
  if (!checkRateLimit(`bidder-auth:${ip}`, 20, 60_000).allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = bidderAuthSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details." },
      { status: 400 },
    );
  }

  const { name, pin, anonymous } = parsed.data;
  const mobile = normaliseMobile(parsed.data.mobile);
  if (mobile.length < 6) {
    return NextResponse.json(
      { error: "Please enter a valid mobile number." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.bidder.findUnique({ where: { mobile } });

    if (existing) {
      const ok = await bcrypt.compare(pin, existing.pinHash);
      if (!ok) {
        return NextResponse.json(
          {
            error:
              "That mobile number is already registered with a different PIN. Enter the PIN you chose, or use a different number.",
          },
          { status: 401 },
        );
      }
      // Keep name + anonymity preference fresh if they changed either.
      if (existing.name !== name || existing.anonymous !== anonymous) {
        await prisma.bidder.update({
          where: { id: existing.id },
          data: { name, anonymous },
        });
      }
      await setBidderCookie(existing.id);
      return NextResponse.json({
        bidder: { id: existing.id, name, mobile: existing.mobile, anonymous },
        returning: true,
      });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    const created = await prisma.bidder.create({
      data: { name, mobile, pinHash, anonymous },
      select: { id: true, name: true, mobile: true, anonymous: true },
    });
    await setBidderCookie(created.id);
    return NextResponse.json({ bidder: created, returning: false }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "bidder.auth.failed");
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}

/** Sign out on this device (does not delete the Bidder or its bids). */
export async function DELETE() {
  await clearBidderCookie();
  return NextResponse.json({ ok: true });
}
