const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ] ?? character,
  );

const shell = (title: string, body: string, iconDataUrl: string) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(title)} · 딱담아</title>
<style>
:root{font-family:Inter,Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#191f28;background:#f7f8fa}*{box-sizing:border-box}body{margin:0}a{color:inherit}.nav{height:68px;display:flex;align-items:center;justify-content:space-between;max-width:1080px;margin:auto;padding:0 24px}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-size:20px;font-weight:850;letter-spacing:-.5px}.brand img{width:36px;height:36px;border-radius:12px;box-shadow:0 4px 14px rgba(49,130,246,.22)}.navlinks{display:flex;gap:18px;color:#6b7684;font-size:14px}.navlinks a{text-decoration:none}.page{max-width:960px;margin:0 auto;padding:72px 24px 100px}.hero{text-align:center;padding:48px 0 72px}.hero img{width:108px;height:108px;border-radius:30px;box-shadow:0 18px 50px rgba(49,130,246,.25)}h1{margin:24px 0 14px;font-size:clamp(38px,7vw,68px);line-height:1.08;letter-spacing:-2.5px}h2{margin:36px 0 12px;font-size:25px;letter-spacing:-.7px}.lead{max-width:690px;margin:0 auto;color:#6b7684;font-size:19px;line-height:1.65}.pills{display:flex;justify-content:center;flex-wrap:wrap;gap:9px;margin-top:26px}.pill{padding:10px 14px;border-radius:999px;background:#e8f3ff;color:#1769e0;font-size:13px;font-weight:750}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card,.document{background:#fff;border:1px solid #edf0f2;border-radius:26px;box-shadow:0 12px 34px rgba(0,27,55,.055)}.card{padding:26px}.card b{font-size:18px}.card p,.document p,.document li{color:#4e5968;line-height:1.75}.document{padding:34px;max-width:760px;margin:auto}.status{display:inline-flex;align-items:center;gap:8px;margin-top:28px;padding:11px 15px;border-radius:999px;background:#edf8f1;color:#16883f;font-weight:750}.status:before{content:"";width:8px;height:8px;border-radius:50%;background:#20a653}.foot{border-top:1px solid #e5e8eb;padding:28px 24px 42px;text-align:center;color:#8b95a1;font-size:13px}@media(max-width:720px){.grid{grid-template-columns:1fr}.page{padding-top:36px}.navlinks{gap:10px;font-size:12px}.document{padding:24px}h1{letter-spacing:-1.6px}}
</style></head><body><nav class="nav"><a class="brand" href="/"><img src="${iconDataUrl}" alt=""><span>딱담아</span></a><div class="navlinks"><a href="/privacy">개인정보</a><a href="/terms">이용약관</a><a href="/support">지원</a></div></nav>${body}<footer class="foot">© 2026 DdakDama · 결제와 주문 확정은 사용자가 쿠팡에서 직접 진행합니다.</footer></body></html>`;

export const landingPage = (iconDataUrl: string) =>
  shell(
    "쇼핑 목록을 한 번에",
    `<main class="page"><section class="hero"><img src="${iconDataUrl}" alt="딱담아 아이콘"><h1>쇼핑 목록을<br>딱, 장바구니로</h1><p class="lead">여러 줄의 상품 목록을 정확한 규격과 수량으로 나누고, 쿠팡 후보와 가격을 확인한 뒤 사용자가 승인한 상품만 장바구니에 담습니다.</p><div class="pills"><span class="pill">ChatGPT 앱 연동</span><span class="pill">Chrome 확장 프로그램</span><span class="pill">자동 결제 없음</span></div><span class="status">공개 서버 정상 운영 중</span></section><section class="grid"><article class="card"><b>목록을 정확하게</b><p>100mg과 240정, 제품 규격과 구매 수량을 구분해 해석합니다.</p></article><article class="card"><b>상품을 투명하게</b><p>가격·묶음·배송 정보를 비교하고 일치하지 않으면 직접 선택할 수 있습니다.</p></article><article class="card"><b>마지막 결정은 사용자에게</b><p>담기 전 실제 상품과 수량을 검증하며 결제나 주문은 자동화하지 않습니다.</p></article></section></main>`,
    iconDataUrl,
  );

export const privacyPage = (iconDataUrl: string) =>
  shell(
    "개인정보 처리방침",
    `<main class="page"><article class="document"><h1>개인정보 처리방침</h1><p>시행일: 2026년 7월 14일</p><h2>수집하는 정보</h2><p>딱담아는 계정 비밀번호, 결제수단, 카드번호 또는 쿠팡 세션 쿠키를 수집하지 않습니다. 서비스 운영을 위해 일회용 페어링 코드, 무작위 기기 토큰, 사용자가 전송한 쇼핑 목록과 처리 상태를 제한적으로 처리합니다.</p><h2>보관 기간</h2><ul><li>페어링 코드: 최대 10분</li><li>장바구니 계획 전달 데이터: 최대 15분</li><li>기기 연결 정보: 최대 30일 또는 사용자의 연결 해제 시점까지</li></ul><h2>제3자 서비스</h2><p>상품 검색과 장바구니 처리는 사용자의 브라우저에서 쿠팡 페이지를 통해 수행됩니다. ChatGPT 앱 기능에는 OpenAI의 서비스가, 공개 서버에는 Cloudflare Workers가 사용됩니다.</p><h2>삭제</h2><p>확장 프로그램의 연결 해제를 실행하면 해당 기기의 연결 토큰과 대기 중인 전달 데이터가 폐기됩니다.</p></article></main>`,
    iconDataUrl,
  );

export const termsPage = (iconDataUrl: string) =>
  shell(
    "이용약관",
    `<main class="page"><article class="document"><h1>이용약관</h1><p>시행일: 2026년 7월 14일</p><h2>서비스 범위</h2><p>딱담아는 쇼핑 목록 분석, 상품 후보 비교와 사용자가 승인한 장바구니 추가를 돕는 보조 서비스입니다.</p><h2>사용자 확인</h2><p>가격, 재고, 배송비, 옵션과 최종 주문 금액은 변경될 수 있습니다. 사용자는 결제 전에 쿠팡 장바구니와 주문 화면의 정보를 직접 확인해야 합니다.</p><h2>금지 사항</h2><p>보안 확인 우회, 비정상적인 대량 요청, 타인의 계정 또는 연결 코드 무단 사용을 금지합니다.</p><h2>책임 제한</h2><p>딱담아는 자동 결제나 주문 확정을 수행하지 않으며, 제휴 링크 생성만으로 수익 또는 구매 결과를 보장하지 않습니다.</p></article></main>`,
    iconDataUrl,
  );

export const supportPage = (iconDataUrl: string) =>
  shell(
    "지원",
    `<main class="page"><article class="document"><h1>도움이 필요하신가요?</h1><h2>먼저 확인해 주세요</h2><ul><li>확장 프로그램에서 새 6자리 연결 코드를 만든 뒤 10분 안에 입력합니다.</li><li>상품이 일치하지 않으면 후보를 펼쳐 직접 선택하거나 검색어를 줄여 다시 검색합니다.</li><li>장바구니 결과는 쿠팡의 실제 장바구니 페이지에서 마지막으로 확인합니다.</li></ul><h2>안전 원칙</h2><p>API 키, 비밀번호, 인증 코드나 결제 정보를 문의 내용에 포함하지 마세요. 공개 지원 연락처는 정식 출시 전에 이 페이지에 추가됩니다.</p></article></main>`,
    iconDataUrl,
  );
