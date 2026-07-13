import type { CandidateProduct,SelectionPlan,ShoppingRequestLine } from "./schemas.js";
export function planQuantity(request:ShoppingRequestLine,candidate:Pick<CandidateProduct,"unitsPerPackage"|"currentPrice"|"stockStatus"|"requiredOption">):SelectionPlan{
  const requested=request.requestedPhysicalUnits,units=candidate.unitsPerPackage,cartPurchaseQuantity=Math.ceil(requested/units),suppliedPhysicalUnits=cartPurchaseQuantity*units,overageUnits=suppliedPhysicalUnits-requested,exactQuantityMatch=overageUnits===0,blockReasons:string[]=[];
  if(!exactQuantityMatch)blockReasons.push("요청 수량을 정확히 충족하지 않습니다.");
  if(!candidate.currentPrice)blockReasons.push("현재 판매가격을 확인하지 못했습니다.");
  if(candidate.stockStatus!=="IN_STOCK")blockReasons.push("재고를 확인하지 못했거나 품절입니다.");
  if(candidate.requiredOption)blockReasons.push("필수 옵션을 직접 선택해야 합니다.");
  return{requestedPhysicalUnits:requested,candidateUnitsPerPackage:units,cartPurchaseQuantity,suppliedPhysicalUnits,overageUnits,exactQuantityMatch,quantityExplanation:`${request.unitSizeValue??""}${request.unitSizeUnit??""} ${units===1?"단품":`${units}개 묶음`} × ${cartPurchaseQuantity} = 실물 ${suppliedPhysicalUnits}개`.trim(),eligibleForAutomaticAdd:blockReasons.length===0,blockReasons};
}
export const cartDeltaMatches=(before:number,after:number,expectedIncrease:number)=>after-before===expectedIncrease;
