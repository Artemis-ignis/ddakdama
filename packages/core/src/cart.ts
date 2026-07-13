export const cartResultStatuses=["SUCCESS","PRICE_UNVERIFIED","PRODUCT_MISMATCH","QUANTITY_MISMATCH","OPTION_REQUIRED","OUT_OF_STOCK","ADD_BUTTON_NOT_FOUND","CART_VERIFICATION_FAILED","LOGIN_REQUIRED","SECURITY_CHECK_REQUIRED","NETWORK_ERROR","UNKNOWN_ERROR"] as const;
export type CartResultStatus=typeof cartResultStatuses[number];
export type CartLineResult={requestLineId:string;status:CartResultStatus;requestedPhysicalUnits:number;addedPhysicalUnits:number;cartPurchaseQuantity:number;beforeQuantity:number;afterQuantity:number;expectedPrice:number|null;actualPrice:number|null;message:string};
export type CartRunStatus="ALL_SUCCESS"|"PARTIAL_FAILURE"|"ALL_FAILED"|"USER_ACTION_REQUIRED"|"CANCELLED";
export function summarizeCartRun(lines:CartLineResult[]):{status:CartRunStatus;requestedKinds:number;successKinds:number;failedKinds:number;requestedPhysicalUnits:number;addedPhysicalUnits:number}{
 const successKinds=lines.filter(x=>x.status==="SUCCESS").length;
 const action=lines.some(x=>["OPTION_REQUIRED","LOGIN_REQUIRED","SECURITY_CHECK_REQUIRED"].includes(x.status));
 const status:CartRunStatus=successKinds===lines.length&&lines.length>0?"ALL_SUCCESS":successKinds===0?(action?"USER_ACTION_REQUIRED":"ALL_FAILED"):"PARTIAL_FAILURE";
 return{status,requestedKinds:lines.length,successKinds,failedKinds:lines.length-successKinds,requestedPhysicalUnits:lines.reduce((s,x)=>s+x.requestedPhysicalUnits,0),addedPhysicalUnits:lines.reduce((s,x)=>s+x.addedPhysicalUnits,0)};
}
