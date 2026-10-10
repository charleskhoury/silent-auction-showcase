import { NextResponse } from "next/server";
import { listPublicItems } from "@/lib/auction";
import { getBidderId } from "@/lib/bidderSession";

export const dynamic = "force-dynamic";

/**
 * Public, poll-friendly snapshot of the auction. The client fetches this
 * every few seconds for the "live" high-bid feel — cheap, and bulletproof
 * through Cloudflare's proxy (no held connections like SSE/WebSocket).
 */
export async function GET() {
  const bidderId = await getBidderId();
  const data = await listPublicItems(bidderId);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
