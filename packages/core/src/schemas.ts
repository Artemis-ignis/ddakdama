import { z } from "zod";

export const shoppingRequestLineSchema = z.object({
  id:z.string(), rawText:z.string(), normalizedText:z.string(), brand:z.string().nullable(), productName:z.string(), variantTokens:z.array(z.string()),
  unitSizeValue:z.number().positive().nullable(), unitSizeUnit:z.enum(["mL","L","g","kg"]).nullable(),
  strengthValue:z.number().positive().nullable(), strengthUnit:z.enum(["mg","mcg","IU","%"]).nullable(),
  packageContentCount:z.number().int().positive().nullable(), packageContentUnit:z.enum(["정","캡슐","포","매","개입","스틱","패치"]).nullable(),
  requestedPhysicalUnits:z.number().int().positive(), requestedPurchaseUnits:z.number().int().positive(),
  parserConfidence:z.number().min(0).max(1), parseWarnings:z.array(z.string())
});
export type ShoppingRequestLine=z.infer<typeof shoppingRequestLineSchema>;

export const candidateProductSchema=z.object({
  id:z.string(),productId:z.string(),vendorItemId:z.string().nullable(),title:z.string(),brand:z.string().nullable(),
  unitSizeValue:z.number().positive().nullable(),unitSizeUnit:z.string().nullable(),strengthValue:z.number().positive().nullable(),strengthUnit:z.string().nullable(),
  packageContentCount:z.number().int().positive().nullable(),packageContentUnit:z.string().nullable(),unitsPerPackage:z.number().int().positive(),
  currentPrice:z.number().int().positive().nullable(),shippingFee:z.number().int().nonnegative().nullable(),stockStatus:z.enum(["IN_STOCK","OUT_OF_STOCK","UNKNOWN"]),
  requiredOption:z.boolean(),productUrl:z.string().url(),imageUrl:z.string().url().nullable(),seller:z.string().nullable(),rocketDelivery:z.boolean(),
  rating:z.number().min(0).max(5).nullable(),reviewCount:z.number().int().nonnegative().nullable(),source:z.enum(["PARTNERS","BROWSER","FIXTURE"])
});
export type CandidateProduct=z.infer<typeof candidateProductSchema>;
export type SelectionPlan={requestedPhysicalUnits:number;candidateUnitsPerPackage:number;cartPurchaseQuantity:number;suppliedPhysicalUnits:number;overageUnits:number;exactQuantityMatch:boolean;quantityExplanation:string;eligibleForAutomaticAdd:boolean;blockReasons:string[]};
