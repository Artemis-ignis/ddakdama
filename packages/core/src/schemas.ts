import { z } from "zod";

export const shoppingRequestLineSchema = z.object({
  id: z.string().min(1).max(100), rawText: z.string().min(1).max(500), normalizedText: z.string().min(1).max(500),
  brand: z.string().max(100).nullable(), productName: z.string().min(1).max(300), variantTokens: z.array(z.string().max(100)).max(30),
  unitSizeValue: z.number().positive().max(100_000).nullable(), unitSizeUnit: z.enum(["mL", "L", "g", "kg"]).nullable(),
  strengthValue: z.number().positive().max(100_000).nullable(), strengthUnit: z.enum(["mg", "mcg", "IU", "%"]).nullable(),
  packageContentCount: z.number().int().positive().max(10_000).nullable(), packageContentUnit: z.string().min(1).max(20).nullable(),
  requestedPhysicalUnits: z.number().int().positive().max(10_000), requestedPurchaseUnits: z.number().int().positive().max(10_000),
  parserConfidence: z.number().min(0).max(1), parseWarnings: z.array(z.string().max(200)).max(20),
});
export type ShoppingRequestLine = z.infer<typeof shoppingRequestLineSchema>;

export const candidateProductSchema = z.object({
  id: z.string(), productId: z.string(), vendorItemId: z.string().nullable(), title: z.string(), brand: z.string().nullable(),
  unitSizeValue: z.number().positive().nullable(), unitSizeUnit: z.string().nullable(), strengthValue: z.number().positive().nullable(), strengthUnit: z.string().nullable(),
  packageContentCount: z.number().int().positive().nullable(), packageContentUnit: z.string().nullable(), unitsPerPackage: z.number().int().positive(),
  currentPrice: z.number().int().positive().nullable(), shippingFee: z.number().int().nonnegative().nullable(), stockStatus: z.enum(["IN_STOCK", "OUT_OF_STOCK", "UNKNOWN"]),
  requiredOption: z.boolean(), productUrl: z.string().url(), imageUrl: z.string().url().nullable(), seller: z.string().nullable(), rocketDelivery: z.boolean(),
  rating: z.number().min(0).max(5).nullable(), reviewCount: z.number().int().nonnegative().nullable(), source: z.enum(["PARTNERS", "BROWSER", "FIXTURE"]),
});
export type CandidateProduct = z.infer<typeof candidateProductSchema>;
export type SelectionPlan = { requestedPhysicalUnits: number; candidateUnitsPerPackage: number; cartPurchaseQuantity: number; suppliedPhysicalUnits: number; overageUnits: number; exactQuantityMatch: boolean; quantityExplanation: string; eligibleForAutomaticAdd: boolean; blockReasons: string[] };
