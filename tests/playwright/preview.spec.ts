import{test,expect}from"@playwright/test";

for(const route of["/dev/list","/dev/candidates","/dev/preflight","/dev/preflight-partial","/dev/result-success","/dev/result-partial-failure"]){
 test(`${route} 실제 Side Panel 컴포넌트 렌더링`,async({page})=>{await page.goto(route);await expect(page.locator("main.app-shell")).toBeVisible();for(const hiddenDeveloperLabel of["MCP URL","Server Origin","Extension Token","API Endpoint"])await expect(page.getByText(hiddenDeveloperLabel,{exact:false})).toHaveCount(0);await expect(page.locator("main.app-shell")).toHaveScreenshot(`${route.split("/").at(-1)}.png`,{animations:"disabled"})});
}

test("후보를 바꾸면 예상 합계가 갱신된다",async({page})=>{await page.goto("/dev/candidates");const total=page.getByTestId("estimated-total");const before=await total.textContent();await page.getByTestId("product-0").locator("button.product-row-main").click();const candidates=page.getByTestId("product-0").locator("button.candidate-row:enabled");await expect(candidates).toHaveCount(2);await candidates.nth(1).click();await expect(total).not.toHaveText(before??"")});

test("부분 실패는 전체 성공으로 표시하지 않는다",async({page})=>{await page.goto("/dev/result-partial-failure");await expect(page.getByText("성공 4종 · 실패 1종입니다. 실패 상품을 확인해 주세요.")).toBeVisible();await expect(page.getByText("모두 검증해 담았습니다.")).toHaveCount(0);await expect(page.getByRole("button",{name:"상품 페이지"})).toBeVisible();await expect(page.getByRole("button",{name:"다시 시도",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"실패 1종 다시 시도"})).toBeVisible()});

test("GPT 앱 연결은 한 번의 클릭으로 읽기 쉬운 6자리 코드를 보여준다",async({page})=>{await page.goto("/dev/list");const connect=page.getByRole("button",{name:"연결하기"});await expect(connect).toHaveCount(1);await connect.click();await expect(page.getByLabel("연결 코드 482731")).toHaveText("482 731");await expect(page.getByRole("button",{name:"목록 받기"})).toBeVisible();await expect(page.locator("main.app-shell")).toHaveScreenshot("gpt-connection-code.png",{animations:"disabled"})});

test("첫 화면은 비어 있고 예시는 사용자가 요청할 때만 채운다",async({page})=>{await page.goto("/dev/list");await expect(page.getByRole("heading",{name:"쇼핑 목록을 준비해 주세요"})).toBeVisible();await expect(page.getByLabel("직접 붙여넣기")).toHaveValue("");await expect(page.getByRole("button",{name:"목록을 입력해 주세요"})).toBeDisabled();await page.getByRole("button",{name:"예시 불러오기"}).click();await expect(page.getByLabel("직접 붙여넣기")).toHaveValue(/닥터지 레드 블레미쉬/);await expect(page.getByRole("button",{name:"실제 상품 찾기"})).toBeEnabled()});

test("직접 붙여넣은 목록은 하단 CTA에서 인식할 수 있다",async({page})=>{await page.goto("/dev/list");await page.getByLabel("직접 붙여넣기").fill("생수 2L 6개");const recognize=page.getByRole("button",{name:"목록 인식하기"});await expect(recognize).toBeEnabled();await recognize.click();await expect(page.getByRole("heading",{name:"상품 1종 · 실물 6개"})).toBeVisible();await expect(page.getByRole("button",{name:"실제 상품 찾기"})).toBeEnabled()});

test("360px 연결 코드 상태는 가로 스크롤 없이 표시된다",async({page})=>{await page.setViewportSize({width:360,height:800});await page.goto("/dev/list");await page.getByRole("button",{name:"연결하기"}).click();await expect(page.getByLabel("연결 코드 482731")).toHaveText("482 731");const metrics=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)});

test("사전검사 실패는 금액·실물수량과 함께 명시적 부분 담기를 제공한다",async({page})=>{await page.goto("/dev/preflight-partial");await expect(page.getByText("사전검사 통과 4종 · 확인 필요 1종입니다.")).toBeVisible();await expect(page.getByRole("button",{name:"확인된 4종 · 실물 6개 담기"})).toBeEnabled();await expect(page.getByText("48,090원",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"문제 상품 확인"})).toBeVisible();await expect(page.getByRole("button",{name:"다시 확인"})).toBeEnabled();await expect(page.getByRole("button",{name:"5종 장바구니에 담기"})).toHaveCount(0)});

test("묶음 상품 결과는 장바구니 행이 아닌 실물 수량으로 설명한다",async({page})=>{await page.goto("/dev/result-success");await expect(page.getByText("2개 묶음 1세트 담음 · 실물 2개",{exact:false})).toHaveCount(2);await expect(page.getByText("수량 0 → 1",{exact:false})).toHaveCount(0)});
