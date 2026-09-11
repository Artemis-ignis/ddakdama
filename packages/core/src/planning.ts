import { z } from "zod";
import { parseShoppingList } from "./parser.js";
import { shoppingRequestLineSchema } from "./schemas.js";
import { buildClarificationForRequest } from "./clarification.js";

export const fulfillmentTypes = [
  "ROCKET",
  "ROCKET_FRESH",
  "SELLER_DELIVERY",
  "ROCKET_DIRECT",
  "UNKNOWN",
] as const;
export const deliveryCertainties = ["CONFIRMED", "CONDITIONAL", "UNKNOWN"] as const;
export const cartPlanStatuses = ["DRAFT", "RESOLVING", "REVIEW_REQUIRED", "READY", "ARCHIVED"] as const;
export const cartExecutionStatuses = ["CREATED", "WAITING_FOR_DEVICE", "READY", "RUNNING", "PAUSED_FOR_USER", "COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED", "EXPIRED"] as const;
export const cartExecutionItemStatuses = ["PENDING", "OPENING_AFFILIATE_URL", "WAITING_FOR_PRODUCT_PAGE", "VERIFYING_PRODUCT", "PRICE_CHANGED", "OPTION_REQUIRED", "ADDING_TO_CART", "VERIFYING_CART_DELTA", "ADDED", "SKIPPED", "FAILED"] as const;

export const affiliateLinkSchema = z.object({
  canonicalUrl: z.url(),
  partnersSearchUrl: z.url().nullable(),
  affiliateUrl: z.url().nullable(),
  affiliateVerified: z.boolean(),
  affiliateResolvedAt: z.number().int().nonnegative().nullable(),
  affiliateSubId: z.string().max(64).nullable(),
});

export const productCandidateSchema = affiliateLinkSchema.extend({
  id: z.string().min(1).max(200),
  productId: z.string().min(1).max(100),
  vendorItemId: z.string().max(100).nullable(),
  itemId: z.string().max(100).nullable(),
  title: z.string().min(1).max(500),
  currentPrice: z.number().int().positive().nullable(),
  unitsPerPackage: z.number().int().positive().max(10_000),
  imageUrl: z.url().nullable(),
  seller: z.string().max(200).nullable(),
  fulfillmentType: z.enum(fulfillmentTypes),
  deliveryPromise: z.string().max(300).nullable(),
  shippingFee: z.number().int().nonnegative().nullable(),
  freeShippingThreshold: z.number().int().positive().nullable(),
  deliveryCertainty: z.enum(deliveryCertainties),
  stockStatus: z.enum(["IN_STOCK", "OUT_OF_STOCK", "UNKNOWN"]),
  requiredOption: z.boolean(),
  source: z.enum(["PARTNERS", "BROWSER", "FIXTURE"]),
});
export type ProductCandidate = z.infer<typeof productCandidateSchema>;

export const cartPlanItemSchema = z.object({
  id: z.string().min(1).max(100),
  request: shoppingRequestLineSchema,
  candidates: z.array(productCandidateSchema).max(10),
  selectedCandidateId: z.string().max(200).nullable(),
  clarification: z.object({
    id: z.string().min(1).max(120),
    itemId: z.string().min(1).max(100),
    question: z.string().min(1).max(500),
    options: z.array(z.object({ id: z.string().min(1).max(80), label: z.string().min(1).max(120), example: z.string().max(200).optional() })).max(8),
    allowFreeText: z.boolean(),
    confidence: z.number().min(0).max(1),
    status: z.enum(["REQUIRED", "ANSWERED", "SKIPPED"]),
    answer: z.string().max(300).nullable(),
    source: z.enum(["RULE", "AI"]),
  }).nullable().optional(),
});

export const shoppingContextSchema = z.object({
  goal: z.string().min(1).max(300).nullable(),
  budgetWon: z.number().int().positive().max(100_000_000).nullable(),
  notes: z.array(z.string().min(1).max(300)).max(10),
});
export type ShoppingContext = z.infer<typeof shoppingContextSchema>;

export const cartPlanSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(cartPlanStatuses),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  context: shoppingContextSchema.optional(),
  items: z.array(cartPlanItemSchema).min(1).max(50),
});
export type CartPlan = z.infer<typeof cartPlanSchema>;

export const cartExecutionItemSchema = z.object({
  id: z.string().min(1).max(100),
  planItemId: z.string().min(1).max(100),
  candidate: productCandidateSchema,
  requestedPhysicalUnits: z.number().int().positive(),
  cartPurchaseQuantity: z.number().int().positive(),
  status: z.enum(cartExecutionItemStatuses),
  message: z.string().max(500).nullable(),
  updatedAt: z.number().int().nonnegative(),
});
export type CartExecutionItem = z.infer<typeof cartExecutionItemSchema>;

export const cartExecutionSchema = z.object({
  id: z.uuid(),
  planId: z.uuid(),
  planVersion: z.number().int().positive(),
  status: z.enum(cartExecutionStatuses),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  items: z.array(cartExecutionItemSchema).min(1).max(50),
});
export type CartExecution = z.infer<typeof cartExecutionSchema>;

export function createCartPlan(
  shoppingList: string,
  id = crypto.randomUUID(),
  now = Date.now(),
  context?: ShoppingContext,
): CartPlan {
  const requests = parseShoppingList(shoppingList);
  if (!requests.length) throw new Error("EMPTY_CART_PLAN");
  return cartPlanSchema.parse({
    id,
    version: 1,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    ...(context ? { context } : {}),
    items: requests.map((request) => ({
      id: request.id,
      request,
      candidates: [],
      selectedCandidateId: null,
      clarification: buildClarificationForRequest(request),
    })),
  });
}

export function selectedCandidate(item: z.infer<typeof cartPlanItemSchema>): ProductCandidate | null {
  return item.candidates.find((candidate) => candidate.id === item.selectedCandidateId) ?? null;
}

export function finalizePlanStatus(plan: CartPlan): CartPlan["status"] {
  if (plan.items.some((item) => item.clarification?.status === "REQUIRED")) return "DRAFT";
  const selected = plan.items.map(selectedCandidate);
  if (!selected.every(Boolean)) return "REVIEW_REQUIRED";
  return selected.every((candidate) => candidate?.affiliateVerified) ? "READY" : "REVIEW_REQUIRED";
}

export function cartPurchaseQuantityFor(item: z.infer<typeof cartPlanItemSchema>, candidate: ProductCandidate): number {
  return Math.ceil(item.request.requestedPhysicalUnits / candidate.unitsPerPackage);
}

export function createCartExecution(plan: CartPlan, id = crypto.randomUUID(), now = Date.now(), ttlMs = 15 * 60 * 1_000): CartExecution {
  const items = plan.items.map((item) => {
    if (item.clarification?.status === "REQUIRED") throw new Error("CLARIFICATION_REQUIRED");
    const candidate = selectedCandidate(item);
    if (!candidate) throw new Error("PLAN_ITEM_NOT_SELECTED");
    const cartPurchaseQuantity = cartPurchaseQuantityFor(item, candidate);
    return {
      id: item.id,
      planItemId: item.id,
      candidate,
      requestedPhysicalUnits: item.request.requestedPhysicalUnits,
      cartPurchaseQuantity,
      status: "PENDING" as const,
      message: null,
      updatedAt: now,
    };
  });
  return cartExecutionSchema.parse({
    id,
    planId: plan.id,
    planVersion: plan.version,
    status: "WAITING_FOR_DEVICE",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ttlMs,
    items,
  });
}
