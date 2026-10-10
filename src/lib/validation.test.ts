import { describe, it, expect } from "vitest";
import {
  bidderAuthSchema,
  placeBidSchema,
  itemCreateSchema,
  settingsUpdateSchema,
  declareWinnerSchema,
} from "@/lib/validation";

// A syntactically valid cuid for the schemas that require one.
const CUID = "cjld2cjxh0000qzrmn831i7rn";

describe("bidderAuthSchema", () => {
  it("accepts a valid guest identity and defaults anonymous to false", () => {
    const parsed = bidderAuthSchema.parse({ name: "Jamie Lee", mobile: "0412345678", pin: "1234" });
    expect(parsed.anonymous).toBe(false);
    expect(parsed.name).toBe("Jamie Lee");
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(bidderAuthSchema.safeParse({ name: "A", mobile: "0412345678", pin: "1234" }).success).toBe(false);
  });

  it("requires a 4-digit PIN", () => {
    expect(bidderAuthSchema.safeParse({ name: "Jamie Lee", mobile: "0412345678", pin: "12" }).success).toBe(false);
    expect(bidderAuthSchema.safeParse({ name: "Jamie Lee", mobile: "0412345678", pin: "abcd" }).success).toBe(false);
  });
});

describe("placeBidSchema", () => {
  it("accepts a cuid item id and a positive integer amount", () => {
    expect(placeBidSchema.parse({ itemId: CUID, amountCents: 5000 }).amountCents).toBe(5000);
  });

  it("rejects a non-cuid item id", () => {
    expect(placeBidSchema.safeParse({ itemId: "not-a-cuid", amountCents: 5000 }).success).toBe(false);
  });

  it("rejects non-positive amounts and amounts over the sanity cap", () => {
    expect(placeBidSchema.safeParse({ itemId: CUID, amountCents: 0 }).success).toBe(false);
    expect(placeBidSchema.safeParse({ itemId: CUID, amountCents: -1 }).success).toBe(false);
    expect(placeBidSchema.safeParse({ itemId: CUID, amountCents: 100_000_001 }).success).toBe(false);
  });
});

describe("itemCreateSchema", () => {
  it("applies defaults for the optional fields", () => {
    const parsed = itemCreateSchema.parse({ title: "Signed jersey" });
    expect(parsed.startingPriceCents).toBe(0);
    expect(parsed.minIncrementCents).toBe(500);
    expect(parsed.description).toBe("");
    expect(parsed.closeAt).toBeNull();
  });

  it("requires a title", () => {
    expect(itemCreateSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects an increment below $1", () => {
    expect(itemCreateSchema.safeParse({ title: "x", minIncrementCents: 50 }).success).toBe(false);
  });

  it("parses an ISO closeAt into a Date", () => {
    const parsed = itemCreateSchema.parse({ title: "x", closeAt: "2026-10-10T12:00:00+00:00" });
    expect(parsed.closeAt).toBeInstanceOf(Date);
  });
});

describe("settingsUpdateSchema", () => {
  it("accepts partial updates and a nullable closedMessage", () => {
    expect(settingsUpdateSchema.parse({ biddingEnabled: false }).biddingEnabled).toBe(false);
    expect(settingsUpdateSchema.parse({ closedMessage: null }).closedMessage).toBeNull();
  });
});

describe("declareWinnerSchema", () => {
  it("accepts a bid cuid or null (to clear)", () => {
    expect(declareWinnerSchema.parse({ bidId: CUID }).bidId).toBe(CUID);
    expect(declareWinnerSchema.parse({ bidId: null }).bidId).toBeNull();
  });
});
