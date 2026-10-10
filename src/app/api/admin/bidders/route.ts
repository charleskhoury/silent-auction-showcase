import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

/** Registered bidders, for the admin "add a bid for a guest" picker. */
export async function GET() {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;

  const bidders = await prisma.bidder.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, mobile: true },
  });
  return NextResponse.json({ bidders });
}
