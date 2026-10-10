import { describe, it, expect } from "vitest";
import { formatCents, dollarsToCents, normaliseMobile } from "@/lib/money";

describe("formatCents", () => {
  it("drops the decimals for whole-dollar amounts", () => {
    expect(formatCents(47500)).toBe("$475");
    expect(formatCents(0)).toBe("$0");
  });

  it("shows cents when the amount is not a whole dollar", () => {
    expect(formatCents(47550)).toBe("$475.50");
    expect(formatCents(101)).toBe("$1.01");
  });
});

describe("dollarsToCents", () => {
  it("parses plain and decorated dollar strings into integer cents", () => {
    expect(dollarsToCents("475")).toBe(47500);
    expect(dollarsToCents("$475.50")).toBe(47550);
    expect(dollarsToCents("1,000")).toBe(100000);
    expect(dollarsToCents(" 12.5 ")).toBe(1250);
    expect(dollarsToCents("0")).toBe(0);
  });

  it("accepts a numeric input", () => {
    expect(dollarsToCents(475)).toBe(47500);
  });

  it("rejects malformed, negative, or over-precise amounts", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents("12.345")).toBeNull();
  });
});

describe("normaliseMobile", () => {
  it("strips spaces and punctuation to digits", () => {
    expect(normaliseMobile("0412 345 678")).toBe("0412345678");
    expect(normaliseMobile("(02) 9876 5432")).toBe("0298765432");
  });

  it("converts a leading + (international prefix) to 00", () => {
    expect(normaliseMobile("+61 412 345 678")).toBe("0061412345678");
  });
});
