import {describe,expect,it} from "vitest";
import {parseShoppingList,planQuantity,cartDeltaMatches,summarizeCartRun,parseUnitsPerPackage,titleContainsProductIdentity,type CartLineResult} from "../src/index.js";
const fixture=`닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml
스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개
라운드랩 1025 독도 클렌저 150ml 2개
TS 골드플러스 샴푸 500g
닥터스베스트 고흡수 마그네슘 100mg 240정`;
describe("고정 쇼핑 목록",()=>{const lines=parseShoppingList(fixture);
it("5개 행과 실물 7개",()=>{expect(lines).toHaveLength(5);expect(lines.reduce((s,x)=>s+x.requestedPhysicalUnits,0)).toBe(7)});
it("100mg/240정/1병 분리",()=>{expect(lines[4]).toMatchObject({strengthValue:100,strengthUnit:"mg",packageContentCount:240,packageContentUnit:"정",requestedPhysicalUnits:1})});
it("단품과 묶음 계산",()=>{const base={currentPrice:10000,stockStatus:"IN_STOCK" as const,requiredOption:false};expect(planQuantity(lines[1],{...base,unitsPerPackage:1}).cartPurchaseQuantity).toBe(2);expect(planQuantity(lines[1],{...base,unitsPerPackage:2}).cartPurchaseQuantity).toBe(1);expect(planQuantity(lines[1],{...base,unitsPerPackage:3}).eligibleForAutomaticAdd).toBe(false)});
it("가격 미확인 차단",()=>expect(planQuantity(lines[0],{unitsPerPackage:1,currentPrice:null,stockStatus:"IN_STOCK",requiredOption:false}).eligibleForAutomaticAdd).toBe(false));
it("장바구니 delta 검증",()=>{expect(cartDeltaMatches(1,3,2)).toBe(true);expect(cartDeltaMatches(1,2,2)).toBe(false)});
it("4종 성공을 전체 성공으로 표시하지 않는다",()=>{const ok=(id:string):CartLineResult=>({requestLineId:id,status:"SUCCESS",requestedPhysicalUnits:1,addedPhysicalUnits:1,cartPurchaseQuantity:1,beforeQuantity:0,afterQuantity:1,expectedPrice:1000,actualPrice:1000,message:"성공"});const result=summarizeCartRun([ok("1"),ok("2"),ok("3"),ok("4"),{...ok("5"),status:"PRICE_UNVERIFIED",addedPhysicalUnits:0,afterQuantity:0}]);expect(result).toMatchObject({status:"PARTIAL_FAILURE",successKinds:4,failedKinds:1})});
it("브라우저와 파트너스가 사용할 묶음 문구를 동일하게 해석한다",()=>{
 expect(parseUnitsPerPackage("선 세럼 50ml x2")).toBe(2);
 expect(parseUnitsPerPackage("독도 클렌저 150ml 2개입")).toBe(2);
 expect(parseUnitsPerPackage("독도 클렌저 150ml, 2개 (증정 30ml)")).toBe(2);
 expect(parseUnitsPerPackage("독도 클렌저 150ml (2개) + 증정품")).toBe(2);
 expect(parseUnitsPerPackage("마그네슘 100mg 240정")).toBe(1);
});
it("브랜드와 제품 핵심 토큰이 모두 있어야 같은 상품이다",()=>{
 expect(titleContainsProductIdentity("스킨1004 히알루-시카 워터핏 선 세럼 50ml 2개","스킨1004","스킨1004 히알루 시카 워터핏 선 세럼")).toBe(true);
 expect(titleContainsProductIdentity("스킨1004 톤 브라이트닝 선크림 50ml 2개","스킨1004","스킨1004 히알루 시카 워터핏 선 세럼")).toBe(false);
});
it("붙은 배수와 본품·리필 복합 구성을 분리한다",()=>{const [multiplied,combined]=parseShoppingList("선 세럼 150ml×2\n세정제 본품 1개 + 리필 2개");expect(multiplied).toMatchObject({unitSizeValue:150,unitSizeUnit:"mL",requestedPhysicalUnits:2});expect(combined).toMatchObject({productName:"세정제",requestedPhysicalUnits:3,variantTokens:["본품 1개","리필 2개"]})});
it("한글 용량 단위를 제품명과 수량에서 분리한다",()=>{const [water,refill]=parseShoppingList("삼다수 2리터 16개\n세정제 500밀리리터 2개");expect(water).toMatchObject({productName:"삼다수",unitSizeValue:2,unitSizeUnit:"L",requestedPhysicalUnits:16});expect(refill).toMatchObject({productName:"세정제",unitSizeValue:500,unitSizeUnit:"mL",requestedPhysicalUnits:2})});
it("1+1과 증정 문구가 있어도 실제 판매 묶음을 읽는다",()=>{expect(parseUnitsPerPackage("[본사 정품] 스킨1004 히알루-시카 선세럼 더블기획 1+1 (+여행용 미니 추가 증정), 2개, 50ml")).toBe(2);expect(parseUnitsPerPackage("스킨1004 선 세럼 +샘플20ml 세트, 2개, 50ml")).toBe(2)});
});
