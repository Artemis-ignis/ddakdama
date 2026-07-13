import{describe,expect,it}from"vitest";
import{detailStatus,productMatches,validateProductUrl}from"../src/product-validation";
const job={productUrl:"https://www.coupang.com/vp/products/123?itemId=11&vendorItemId=22",productId:"123",vendorItemId:"22",itemId:"11",expectedBrand:"스킨1004",expectedProductName:"스킨1004 히알루 시카 워터핏 선 세럼",expectedUnitsPerPackage:2,expectedUnitSize:"50ml",expectedStrength:null,expectedPackageContent:null};
const detail={productId:"123",vendorItemId:"22",itemId:"11",title:"스킨1004 히알루-시카 워터핏 선 세럼 50mL, 2개",price:21800,unitsPerPackage:2,inStock:true,optionRequired:false,securityRequired:false,loginRequired:false};
describe("상세페이지 strict preflight",()=>{
 it("복합 SKU와 규격이 모두 같아야 통과한다",()=>{expect(validateProductUrl(job)).toBe(true);expect(productMatches(job,detail)).toBe(true);expect(detailStatus(job,detail)).toBe("READY")});
 it("vendorItem·용량·묶음 중 하나라도 다르면 차단한다",()=>{expect(productMatches(job,{...detail,vendorItemId:"99"})).toBe(false);expect(detailStatus({...job,expectedUnitSize:"150ml"},detail)).toBe("PRODUCT_MISMATCH");expect(detailStatus({...job,expectedUnitsPerPackage:1},detail)).toBe("PRODUCT_MISMATCH")});
 it("규격이 같아도 브랜드나 핵심 제품명이 다르면 차단한다",()=>{expect(detailStatus(job,{...detail,title:"스킨1004 톤 브라이트닝 선크림 50mL, 2개"})).toBe("PRODUCT_MISMATCH");expect(detailStatus(job,{...detail,title:"다른브랜드 히알루 시카 워터핏 선 세럼 50mL, 2개"})).toBe("PRODUCT_MISMATCH")});
 it("보안·로그인·가격·옵션·재고를 구분한다",()=>{expect(detailStatus(job,{...detail,securityRequired:true})).toBe("SECURITY_CHECK_REQUIRED");expect(detailStatus(job,{...detail,loginRequired:true})).toBe("LOGIN_REQUIRED");expect(detailStatus(job,{...detail,price:null})).toBe("PRICE_UNVERIFIED");expect(detailStatus(job,{...detail,optionRequired:true})).toBe("OPTION_REQUIRED");expect(detailStatus(job,{...detail,inStock:false})).toBe("OUT_OF_STOCK")});
});
