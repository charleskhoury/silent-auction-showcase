import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Lightweight, self-contained bidder session — deliberately NOT NextAuth.
 * NextAuth here is only for the handful of committee admins; guests must be
 * able to start bidding in seconds with no OAuth round-trip. A guest proves
 * identity once (name + mobile + PIN) and then carries an HMAC-signed,
 * httpOnly cookie that names their Bidder row. The PIN is the recovery path
 * for a new device; the cookie is the day-to-day credential.
 */
const COOKIE_NAME = "auction_bidder";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — covers the event night + settling.

function secret(): string {
  const s = process.env.BIDDER_SESSION_SECRET;
  if (!s) {
    // Fail loud in dev; in prod the entrypoint/env guarantees it is set.
    throw new Error("BIDDER_SESSION_SECRET is not set");
  }
  return s;
}

function sign(bidderId: string): string {
  return crypto.createHmac("sha256", secret()).update(bidderId).digest("base64url");
}

/** token = "<bidderId>.<hmac>" */
export function issueToken(bidderId: string): string {
  return `${bidderId}.${sign(bidderId)}`;
}

export function verifyToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const bidderId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(bidderId);
  // Constant-time compare on equal-length buffers.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return bidderId;
}

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

/** Read and verify the current bidder id from the request cookies. */
export async function getBidderId(): Promise<string | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

export async function setBidderCookie(bidderId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, issueToken(bidderId), cookieOptions);
}

export async function clearBidderCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
}
