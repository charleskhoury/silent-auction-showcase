import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrRespond } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Every bid across every item, as a CSV for the committee to reconcile and
 * chase payment. Winner flag marks the declared (or highest, if none declared)
 * bid per item. */
export async function GET() {
  const gate = await requireAdminOrRespond();
  if (!gate.ok) return gate.response;

  const items = await prisma.item.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      winnerBidId: true,
      bids: {
        orderBy: [{ amountCents: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          amountCents: true,
          createdAt: true,
          bidder: { select: { name: true, mobile: true } },
        },
      },
    },
  });

  const header = [
    "item",
    "bidder_name",
    "bidder_mobile",
    "amount_aud",
    "placed_at",
    "rank",
    "is_winner",
  ];
  const rows: string[] = [header.map(csvCell).join(",")];

  for (const item of items) {
    const effectiveWinnerId = item.winnerBidId ?? item.bids[0]?.id ?? null;
    item.bids.forEach((bid, index) => {
      rows.push(
        [
          item.title,
          bid.bidder.name,
          bid.bidder.mobile,
          (bid.amountCents / 100).toFixed(2),
          bid.createdAt.toISOString(),
          index + 1,
          bid.id === effectiveWinnerId ? "yes" : "",
        ]
          .map(csvCell)
          .join(","),
      );
    });
  }

  const csv = rows.join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auction-bids-${stamp}.csv"`,
    },
  });
}
