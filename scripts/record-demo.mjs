import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "dist", "demo");
const rawDir = resolve(outputDir, "raw");
const mp4Path = resolve(outputDir, "ddakdama-causal-demo-v1.0.0.mp4");
const legacyMp4Path = resolve(outputDir, "ddakdama-demo-v1.0.0.mp4");
const thumbnailPath = resolve(outputDir, "ddakdama-causal-demo-thumbnail.png");
const legacyThumbnailPath = resolve(outputDir, "ddakdama-demo-thumbnail.png");
const contactSheetPath = resolve(outputDir, "ddakdama-causal-demo-contact-sheet.png");
const previewUrl = "http://127.0.0.1:4273";
const pnpmCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "pnpm";
const pnpmArgs = (args) => process.platform === "win32" ? ["/d", "/s", "/c", "pnpm.cmd", ...args] : args;
const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

const demoPlan = {
  planId: "ddakdama-demo-plan-2026",
  items: [
    { rawText: "닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml", productName: "닥터지 레드 블레미쉬 포 맨 진정 올인원", unitSizeValue: 150, unitSizeUnit: "mL", requestedPhysicalUnits: 1 },
    { rawText: "스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개", productName: "스킨1004 히알루 시카 워터핏 선 세럼", unitSizeValue: 50, unitSizeUnit: "mL", requestedPhysicalUnits: 2 },
    { rawText: "라운드랩 1025 독도 클렌저 150ml 2개", productName: "라운드랩 1025 독도 클렌저", unitSizeValue: 150, unitSizeUnit: "mL", requestedPhysicalUnits: 2 },
    { rawText: "TS 골드플러스 샴푸 500g", productName: "TS 골드플러스 샴푸", unitSizeValue: 500, unitSizeUnit: "g", requestedPhysicalUnits: 1 },
    { rawText: "닥터스베스트 고흡수 마그네슘 100mg 240정", productName: "닥터스베스트 고흡수 마그네슘", strengthValue: 100, strengthUnit: "mg", packageContentCount: 240, packageContentUnit: "정", requestedPhysicalUnits: 1 },
  ],
};

async function previewIsReady() {
  try {
    const response = await fetch(`${previewUrl}/dev/list`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await previewIsReady()) return;
    await pause(500);
  }
  throw new Error("PREVIEW_SERVER_TIMEOUT");
}

function generatedWidgetHtml() {
  const source = readFileSync(resolve(root, "apps", "worker", ".generated", "widget.ts"), "utf8");
  const match = source.match(/export const widgetHtml = (.+);\r?\nexport const appIconDataUrl/);
  if (!match) throw new Error("GENERATED_WIDGET_NOT_FOUND");
  return JSON.parse(match[1]);
}

function generatedIconDataUrl() {
  const source = readFileSync(resolve(root, "apps", "worker", ".generated", "widget.ts"), "utf8");
  const match = source.match(/export const appIconDataUrl = (.+);/);
  if (!match) throw new Error("GENERATED_ICON_NOT_FOUND");
  return JSON.parse(match[1]);
}

function widgetDocument(widgetHtml) {
  const bootstrap = `<script>window.openai={theme:"light",toolOutput:${JSON.stringify(demoPlan)},widgetState:{},setWidgetState:()=>{}};</script>
  <style>html,body{min-height:100%;background:#f7f9fc!important}body{padding:14px!important}.wrap{box-shadow:0 22px 70px rgba(15,35,70,.10)!important}</style>`;
  return widgetHtml.replace('<script type="module">', `${bootstrap}<script type="module">`);
}

function hostDocument(iconDataUrl) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202c;background:#edf3fb}
    *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{background:radial-gradient(circle at 50% -20%,#fff 0,#eef5ff 39%,#e8eef6 100%)}
    .topbar{height:82px;padding:0 44px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(80,105,140,.14);background:rgba(255,255,255,.78);backdrop-filter:blur(26px)}
    .brand{display:flex;align-items:center;gap:14px}.brand img{width:48px;height:48px;border-radius:15px;box-shadow:0 10px 28px rgba(49,130,246,.24)}
    .brand strong{display:block;font-size:22px;letter-spacing:-.5px}.brand span{display:block;margin-top:3px;color:#6b7684;font-size:13px;font-weight:650}
    .live{display:flex;align-items:center;gap:9px;padding:10px 14px;border:1px solid #dbe5f2;border-radius:999px;background:#fff;color:#4e5968;font-size:12px;font-weight:800;letter-spacing:.5px}.live::before{content:"";width:8px;height:8px;border-radius:50%;background:#19a75a;box-shadow:0 0 0 5px rgba(25,167,90,.12)}
    .workspace{height:calc(100% - 184px);display:grid;grid-template-columns:minmax(520px,680px) 100px minmax(560px,700px);justify-content:center;gap:20px;padding:24px 32px 16px;transition:grid-template-columns .7s cubic-bezier(.22,.8,.25,1)}
    body[data-focus="extension"] .workspace{grid-template-columns:400px 76px 760px}body[data-focus="extension"] #widget-pane{opacity:.68;transform:scale(.97)}body[data-focus="extension"] #extension-pane{box-shadow:0 32px 90px rgba(23,91,195,.18)}
    .pane{position:relative;min-width:0;border:1px solid rgba(74,99,133,.16);border-radius:27px;background:rgba(255,255,255,.92);box-shadow:0 24px 72px rgba(29,52,82,.10);overflow:hidden;transition:opacity .6s,transform .6s,box-shadow .6s}
    .pane-head{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #e7edf5;background:#fff;color:#333d4b;font-size:13px;font-weight:850}
    .pane-head span{display:flex;align-items:center;gap:8px}.dot{width:9px;height:9px;border-radius:50%;background:#3182f6}.pane-head small{color:#8b95a1;font-weight:700}
    iframe{display:block;width:100%;height:calc(100% - 48px);border:0;background:#fff}
    .rail{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;color:#8b95a1}.rail-track{position:relative;width:64px;height:64px;border:1px solid #dce7f4;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 12px 30px rgba(25,60,110,.09)}
    .rail-track svg{width:26px;height:26px;fill:none;stroke:#3182f6;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}.rail-track.sending{animation:pulse 1s infinite}.rail-track.received{background:#edf8f1;border-color:#ccebd7}.rail-track.received svg{stroke:#16a05d}.rail b{font-size:11px;text-align:center;line-height:1.4;max-width:78px}
    .story{height:102px;padding:14px 44px 18px;display:flex;align-items:center;gap:20px;border-top:1px solid rgba(80,105,140,.14);background:rgba(255,255,255,.88);backdrop-filter:blur(26px)}
    .step-number{flex:0 0 auto;width:48px;height:48px;border-radius:16px;display:grid;place-items:center;color:#fff;background:#3182f6;font-weight:900;box-shadow:0 12px 24px rgba(49,130,246,.24)}
    .story-copy{min-width:0}.story-copy strong{display:block;font-size:20px;letter-spacing:-.4px}.story-copy p{margin:4px 0 0;color:#6b7684;font-size:13px;line-height:1.45}
    .safety{margin-left:auto;display:flex;align-items:center;gap:8px;color:#6b7684;font-size:12px;font-weight:700}.safety svg{width:18px;stroke:#16a05d}
    #demo-cursor{position:fixed;z-index:2147483647;left:0;top:0;width:24px;height:24px;pointer-events:none;transform:translate(-100px,-100px);transition:transform .52s cubic-bezier(.18,.82,.22,1)}
    #demo-cursor::before{content:"";display:block;width:15px;height:20px;background:#17202c;clip-path:polygon(0 0,0 100%,32% 72%,52% 100%,68% 90%,50% 64%,100% 62%);filter:drop-shadow(0 2px 2px rgba(255,255,255,.8)) drop-shadow(0 3px 6px rgba(0,0,0,.24))}
    .click-ripple{position:fixed;z-index:2147483646;width:12px;height:12px;border:2px solid #3182f6;border-radius:50%;pointer-events:none;animation:ripple .58s ease-out forwards}
    @keyframes ripple{to{transform:scale(5);opacity:0}}@keyframes pulse{50%{transform:scale(1.08);box-shadow:0 16px 40px rgba(49,130,246,.2)}}
  </style></head><body data-focus="both">
    <header class="topbar"><div class="brand"><img src="${iconDataUrl}" alt=""><div><strong>DdakDama</strong><span>One list. Exact quantities. A reviewable cart.</span></div></div><div class="live">CONTINUOUS PRODUCT DEMO</div></header>
    <main class="workspace">
      <section class="pane" id="widget-pane"><header class="pane-head"><span><i class="dot"></i>ChatGPT app</span><small>Plan and handoff</small></header><iframe id="widget-frame" title="DdakDama ChatGPT app"></iframe></section>
      <div class="rail"><div class="rail-track" id="rail-track"><svg viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg></div><b id="rail-label">Not sent yet</b></div>
      <section class="pane" id="extension-pane"><header class="pane-head"><span><i class="dot"></i>Chrome extension</span><small>Search, verify, add</small></header><iframe id="extension-frame" title="DdakDama Chrome extension" src="${previewUrl}/dev/list?theme=light"></iframe></section>
    </main>
    <footer class="story"><div class="step-number" id="step-number">1</div><div class="story-copy"><strong id="step-title">Connect once</strong><p id="step-body">Create a one-time code in the extension, then enter it in the ChatGPT app.</p></div><div class="safety"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>Fixture-backed demo · Checkout is never automated</div></footer>
    <div id="demo-cursor"></div>
    <script>
      const demoPlan=${JSON.stringify(demoPlan)};
      let handoffReceived=false;
      let handoffId=null;
      window.demoRuntimeEvents=[];
      const widgetFrame=document.querySelector('#widget-frame');
      const extensionFrame=document.querySelector('#extension-frame');
      const reply=(source,id,result)=>source.postMessage({jsonrpc:'2.0',id,result},'*');
      const setRail=(label,state='')=>{document.querySelector('#rail-label').textContent=label;document.querySelector('#rail-track').className='rail-track '+state};
      window.addEventListener('message',(event)=>{
        const message=event.data;
        if(message?.type==='DDAKDAMA_DEMO_RUNTIME'){window.demoRuntimeEvents.push(message.messageType);return}
        if(message?.type==='DDAKDAMA_DEMO_ACK'){
          handoffReceived=true;
          setRail('Received by extension','received');
          return;
        }
        if(!message||message.jsonrpc!=='2.0'||message.id==null)return;
        if(message.method==='ui/initialize'){
          reply(event.source,message.id,{protocolVersion:'2026-01-26',hostContext:{theme:'light'},capabilities:{}});
          return;
        }
        if(message.method!=='tools/call')return;
        const name=message.params?.name;
        const args=message.params?.arguments||{};
        if(name==='pair_extension_device'){
          const connected=String(args.pairing_code||'')==='482731';
          reply(event.source,message.id,{structuredContent:{connected},_meta:connected?{connectionGrant:'demo-connection-grant',grantExpiresAt:Date.now()+3600000}:{}});
          return;
        }
        if(name==='send_cart_plan'){
          handoffId='demo-handoff-2026';
          handoffReceived=false;
          setRail('Plan sent','sending');
          extensionFrame.contentWindow.postMessage({type:'DDAKDAMA_DEMO_HANDOFF',handoff:{id:handoffId,payload:{items:args.items||demoPlan.items}}},'*');
          reply(event.source,message.id,{structuredContent:{sent:true},_meta:{handoffId,handoffExpiresAt:Date.now()+600000}});
          return;
        }
        if(name==='get_cart_plan_status'){
          reply(event.source,message.id,{structuredContent:{found:Boolean(handoffId),received:handoffReceived,expired:false}});
          return;
        }
        if(name==='disconnect_extension_device'){
          handoffId=null;handoffReceived=false;setRail('Disconnected');reply(event.source,message.id,{structuredContent:{disconnected:true}});return;
        }
        reply(event.source,message.id,{structuredContent:{}});
      });
      window.demoStep=(step,title,body)=>{document.querySelector('#step-number').textContent=String(step);document.querySelector('#step-title').textContent=title;document.querySelector('#step-body').textContent=body};
      window.demoFocus=(target)=>document.body.dataset.focus=target;
      window.demoMoveCursor=(x,y)=>{document.querySelector('#demo-cursor').style.transform='translate('+(x-3)+'px,'+(y-2)+'px)'};
      window.demoRipple=(x,y)=>{const ripple=document.createElement('i');ripple.className='click-ripple';ripple.style.left=(x-6)+'px';ripple.style.top=(y-6)+'px';document.body.append(ripple);setTimeout(()=>ripple.remove(),650)};
    </script>
  </body></html>`;
}

function stopOwnedPreview(processHandle) {
  if (!processHandle?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(processHandle.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    return;
  }
  processHandle.kill("SIGTERM");
}

async function setStory(page, step, title, body, focus = "both") {
  await page.evaluate(({ step, title, body, focus }) => {
    window.demoStep(step, title, body);
    window.demoFocus(focus);
  }, { step, title, body, focus });
  await pause(650);
}

async function reveal(locator) {
  await locator.evaluate((element) => element.scrollIntoView({ behavior: "smooth", block: "center" }));
  await pause(650);
}

async function moveCursor(page, locator) {
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  if (!box) throw new Error("TARGET_WITHOUT_BOUNDING_BOX");
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.evaluate(({ x, y }) => window.demoMoveCursor(x, y), point);
  await pause(620);
  return point;
}

async function clickWithCursor(page, locator, settle = 900) {
  await reveal(locator);
  const point = await moveCursor(page, locator);
  await locator.click();
  await page.evaluate(({ x, y }) => window.demoRipple(x, y), point);
  await pause(settle);
}

async function typeWithCursor(page, locator, text) {
  await reveal(locator);
  await moveCursor(page, locator);
  await locator.click();
  await locator.pressSequentially(text, { delay: 85 });
  await pause(550);
}

async function waitForEnabled(locator, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return;
    await pause(100);
  }
  throw new Error("CONTROL_DID_NOT_ENABLE");
}

mkdirSync(outputDir, { recursive: true });
rmSync(rawDir, { recursive: true, force: true });
mkdirSync(rawDir, { recursive: true });

const generated = spawnSync(pnpmCommand, pnpmArgs(["--filter", "@ddakdama/worker", "generate:widget"]), { cwd: root, encoding: "utf8" });
if (generated.status !== 0) throw new Error(generated.stderr || "WIDGET_GENERATION_FAILED");

let previewProcess = null;
if (!(await previewIsReady())) {
  previewProcess = spawn(pnpmCommand, pnpmArgs(["--filter", "@ddakdama/extension", "dev:preview"]), { cwd: root, stdio: "ignore", windowsHide: true });
  await waitForPreview();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  colorScheme: "light",
});
const page = await context.newPage();
const video = page.video();

try {
  // Keep the top-level document in a trustworthy localhost context. The cart
  // journal intentionally uses crypto.randomUUID(), which is unavailable when
  // the same UI is embedded under an insecure about:blank recording shell.
  await page.goto(`${previewUrl}/dev/recording-host`, { waitUntil: "domcontentloaded" });
  await page.setContent(hostDocument(generatedIconDataUrl()), { waitUntil: "load" });
  await page.locator("#widget-frame").evaluate((frame, source) => { frame.srcdoc = source; }, widgetDocument(generatedWidgetHtml()));
  const widget = page.frameLocator("#widget-frame");
  const extension = page.frameLocator("#extension-frame");
  await widget.locator("#pairing").waitFor({ state: "visible" });
  await extension.getByRole("button", { name: "6자리 코드 만들기" }).waitFor({ state: "visible" });
  await pause(1_500);

  await setStory(page, 1, "Connect once", "The extension creates a one-time code; no server URL or API key is exposed to the user.");
  await clickWithCursor(page, extension.getByRole("button", { name: "6자리 코드 만들기" }), 1_100);
  const code = (await extension.locator("output.pairing-code").textContent())?.replace(/\s/g, "") ?? "";
  if (code !== "482731") throw new Error(`UNEXPECTED_PAIRING_CODE:${code}`);
  await typeWithCursor(page, widget.locator("#pairing"), code);
  await clickWithCursor(page, widget.locator("#pair"), 1_250);

  await setStory(page, 2, "Send a structured plan", "ChatGPT separates product size, strength, package count, and requested quantity before handoff.");
  await clickWithCursor(page, widget.locator("#send"), 1_000);
  await clickWithCursor(page, extension.getByRole("button", { name: "목록 받기" }), 1_500);
  await extension.getByRole("heading", { name: "상품 5종 · 실물 7개" }).waitFor({ state: "visible" });
  await widget.locator("#received").waitFor({ state: "visible", timeout: 5_000 });
  await pause(1_350);

  await setStory(page, 3, "Search real candidates", "The same extension session now searches candidates for all five requested products.", "extension");
  await clickWithCursor(page, extension.getByRole("button", { name: "실제 상품 찾기" }), 1_200);
  await extension.getByTestId("estimated-total").getByText("74,540원", { exact: true }).waitFor({ state: "visible" });
  await pause(1_300);

  await setStory(page, 4, "Stay in control", "Remove an item, restore it, or choose another candidate—the total updates immediately.", "extension");
  const firstProduct = extension.getByTestId("product-0");
  await clickWithCursor(page, extension.getByRole("button", { name: /닥터지.*이 품목 빼기/ }), 750);
  await extension.getByTestId("estimated-total").getByText("58,340원", { exact: true }).waitFor({ state: "visible" });
  await pause(800);
  await clickWithCursor(page, firstProduct.getByRole("button", { name: "다시 포함" }), 750);
  await extension.getByTestId("estimated-total").getByText("74,540원", { exact: true }).waitFor({ state: "visible" });
  await clickWithCursor(page, firstProduct.locator("button.product-row-main"), 650);
  const alternateCandidate = firstProduct.locator("button.candidate-row").nth(1);
  await clickWithCursor(page, alternateCandidate, 850);
  await extension.getByTestId("estimated-total").getByText("67,736원", { exact: true }).waitFor({ state: "visible" });
  await pause(1_250);

  await setStory(page, 5, "Verify before changing the cart", "Price, product identity, stock, options, and exact quantity must pass the preflight check.", "extension");
  await clickWithCursor(page, extension.getByRole("button", { name: "5종 상세 확인하기" }), 1_250);
  await extension.getByRole("heading", { name: "담기 전 확인" }).waitFor({ state: "visible" });
  await extension.getByText("5개 상품을 모두 확인했어요", { exact: true }).waitFor({ state: "visible" });
  const finalAddButton = extension.getByRole("button", { name: "5종 장바구니에 담기" });
  await waitForEnabled(finalAddButton);
  await pause(1_450);

  await setStory(page, 6, "Add only after approval", "The cart action starts only after the user presses the final button. Checkout is never automated.", "extension");
  await clickWithCursor(page, finalAddButton, 1_500);
  await page.waitForFunction(() => window.demoRuntimeEvents.includes("DDAKDAMA_RUN_CART_JOBS"), undefined, { timeout: 5_000 });
  try {
    await extension.getByRole("heading", { name: "정확하게 모두 담았어요" }).waitFor({ state: "visible", timeout: 8_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({ events: window.demoRuntimeEvents }));
    const extensionText = await extension.locator("body").innerText();
    console.error(JSON.stringify({ diagnostics, extensionText }, null, 2));
    throw error;
  }
  await extension.getByLabel("담은 상품 가격 합계").getByText("67,736원", { exact: true }).first().waitFor({ state: "visible" });
  await pause(2_000);

  await setStory(page, 7, "Finish with a verified result", "Every requested line has an explicit outcome, verified total, and a one-click path to start a new list.", "extension");
  const newListButton = extension.locator("footer").getByRole("button", { name: "새 목록 담기" });
  await reveal(newListButton);
  await pause(1_100);
  await clickWithCursor(page, newListButton, 1_200);
  await extension.getByRole("heading", { name: "쇼핑 목록을 준비해 주세요" }).waitFor({ state: "visible" });
  await setStory(page, 8, "Ready for the next list", "One continuous flow: ChatGPT plan → user review → verified cart result.", "both");
  await pause(2_300);
} finally {
  await page.close();
  await context.close();
  await browser.close();
  stopOwnedPreview(previewProcess);
}

const rawPath = await video.path();
const ffmpeg = spawnSync("ffmpeg", ["-y", "-i", rawPath, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-movflags", "+faststart", mp4Path], { cwd: root, encoding: "utf8" });
if (ffmpeg.status !== 0) throw new Error(ffmpeg.stderr || "FFMPEG_CONVERSION_FAILED");
copyFileSync(mp4Path, legacyMp4Path);

const thumbnail = spawnSync("ffmpeg", ["-y", "-ss", "8", "-i", mp4Path, "-frames:v", "1", "-vf", "scale=1280:720", thumbnailPath], { cwd: root, encoding: "utf8" });
if (thumbnail.status !== 0) throw new Error(thumbnail.stderr || "THUMBNAIL_FAILED");
copyFileSync(thumbnailPath, legacyThumbnailPath);
const contactSheet = spawnSync("ffmpeg", ["-y", "-i", mp4Path, "-vf", "fps=2/13,scale=480:270,tile=4x2", "-frames:v", "1", contactSheetPath], { cwd: root, encoding: "utf8" });
if (contactSheet.status !== 0) throw new Error(contactSheet.stderr || "CONTACT_SHEET_FAILED");

console.log(mp4Path);
console.log(thumbnailPath);
console.log(contactSheetPath);
