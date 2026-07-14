import{describe,expect,it}from"vitest";import{readFileSync}from"node:fs";
describe("사용자 UI 계약",()=>{const source=readFileSync(new URL("../src/ui/App.tsx",import.meta.url),"utf8");
it("개발자 용어를 노출하지 않는다",()=>{for(const word of["MCP URL","Server Origin","Extension Token","Access Key","Secret Key","Mock Adapter","API Endpoint"])expect(source).not.toContain(word)});
it("정확한 숫자와 장바구니 행동을 표시한다",()=>{expect(source).toContain("상품 {lines.length}종");expect(source).toContain("장바구니에 담기")});
it("GPT 앱 연결은 사용자 용어로 제공한다",()=>{expect(source).toContain("ChatGPT에서 목록 받기");expect(source).toContain("목록 받기");expect(source).toContain("6자리 코드")});
it("제휴 고지는 제휴 빌드에서만 표시한다",()=>{expect(source).toContain("AFFILIATE_ENABLED &&");expect(source).toContain("쿠팡 파트너스 활동")});
});
