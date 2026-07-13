import{test,expect}from"@playwright/test";

for(const route of["/dev/candidates","/dev/preflight","/dev/preflight-partial","/dev/result-success","/dev/result-partial-failure"]){
 test(`${route} 실제 Side Panel 컴포넌트 렌더링`,async({page})=>{await page.goto(route);await expect(page.getByRole("heading",{name:"상품 5종 · 실물 7개"})).toBeVisible();for(const hiddenDeveloperLabel of["MCP URL","Server Origin","Extension Token","API Endpoint"])await expect(page.getByText(hiddenDeveloperLabel,{exact:false})).toHaveCount(0);await expect(page.locator("main.app-shell")).toHaveScreenshot(`${route.split("/").at(-1)}.png`,{animations:"disabled"})});
}

test("후보를 바꾸면 예상 합계가 갱신된다",async({page})=>{await page.goto("/dev/candidates");const total=page.getByTestId("estimated-total");const before=await total.textContent();const candidates=page.getByTestId("product-0").locator("button.candidate:enabled");await expect(candidates).toHaveCount(2);await candidates.nth(1).click();await expect(total).not.toHaveText(before??"")});

test("부분 실패는 전체 성공으로 표시하지 않는다",async({page})=>{await page.goto("/dev/result-partial-failure");await expect(page.getByText("성공 4종 · 실패 1종입니다. 실패 상품을 확인해 주세요.")).toBeVisible();await expect(page.getByText("모두 검증해 담았습니다.")).toHaveCount(0);await expect(page.getByRole("button",{name:"상품 페이지"})).toBeVisible();await expect(page.getByRole("button",{name:"다시 시도"})).toBeVisible()});

test("사전검사 실패는 가능한 상품만 담기와 취소를 명시적으로 제공한다",async({page})=>{await page.goto("/dev/preflight-partial");await expect(page.getByText("사전검사 통과 4종 · 확인 필요 1종입니다.")).toBeVisible();await expect(page.getByRole("button",{name:"가능한 4종만 담기"})).toBeEnabled();await expect(page.getByRole("button",{name:"문제 상품 확인"})).toBeVisible();await expect(page.getByRole("button",{name:"취소"})).toBeVisible();await expect(page.getByRole("button",{name:"5종 최종 확인 후 담기"})).toBeDisabled()});
