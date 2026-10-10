import { z } from "zod";

/** Guest identity — used for both first-time registration and reclaiming on a new device. */
export const bidderAuthSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  mobile: z
    .string()
    .trim()
    .min(6, "Please enter a valid mobile number")
    .max(20, "Please enter a valid mobile number"),
  pin: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Your PIN must be 4 digits"),
  anonymous: z.boolean().optional().default(false),
});
export type BidderAuthInput = z.infer<typeof bidderAuthSchema>;

export const placeBidSchema = z.object({
  itemId: z.string().cuid(),
  amountCents: z.number().int().positive().max(100_000_000), // ≤ $1,000,000 sanity cap
});

const centsFromInput = z
  .number()
  .int("Amount must be a whole number of cents")
  .min(0)
  .max(100_000_000);

export const itemCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().trim().max(5000).default(""),
  startingPriceCents: centsFromInput.default(0),
  minIncrementCents: centsFromInput.refine((v) => v >= 100, "Increment must be at least $1").default(500),
  antiSnipeSeconds: z.number().int().min(0).max(3600).default(0),
  displayOrder: z.number().int().min(0).max(10000).default(0),
  closeAt: z
    .union([z.string().datetime({ offset: true }), z.string().length(0), z.null()])
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});

export const itemUpdateSchema = itemCreateSchema.partial().extend({
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
});

export const settingsUpdateSchema = z.object({
  eventName: z.string().trim().min(1).max(160).optional(),
  biddingEnabled: z.boolean().optional(),
  closedMessage: z.string().trim().max(500).nullable().optional(),
});

export const declareWinnerSchema = z.object({
  // null = clear a previously declared winner; a bid id = declare that bid.
  bidId: z.union([z.string().cuid(), z.null()]),
});

// --- Admin bid overrides (bypass the normal min-increment / open-status rules) ---
export const adminBidAmountSchema = z.object({
  amountCents: z.number().int().positive().max(100_000_000),
});

export const adminAddBidSchema = z.object({
  bidderId: z.string().cuid(),
  amountCents: z.number().int().positive().max(100_000_000),
});
