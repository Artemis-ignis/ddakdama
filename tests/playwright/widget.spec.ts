import { expect, test } from "@playwright/test";
import { widgetHtml } from "../../apps/server/src/widget.js";

test("위젯 런타임이 초기화되고 표준 MCP Apps 도구 결과를 렌더링한다", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setContent(`<!doctype html><html><body>
    <iframe id="widget"></iframe>
    <script>
      window.addEventListener("message", (event) => {
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;
        if (message.method === "ui/initialize") {
          event.source.postMessage({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              protocolVersion: "2026-01-26",
              hostCapabilities: { serverTools: {} },
              hostInfo: { name: "ddakdama-fixture", version: "1.0.0" },
              hostContext: { theme: "light" }
            }
          }, "*");
        }
        if (message.method === "ui/notifications/initialized") {
          event.source.postMessage({
            jsonrpc: "2.0",
            method: "ui/notifications/tool-result",
            params: {
              structuredContent: {
                planId: "123e4567-e89b-42d3-a456-426614174000",
                itemKinds: 2,
                physicalUnits: 3,
                items: [
                  { rawText: "생수 2L 2개", productName: "생수", unitSizeValue: 2, unitSizeUnit: "L", requestedPhysicalUnits: 2 },
                  { rawText: "샴푸 500g", productName: "샴푸", unitSizeValue: 500, unitSizeUnit: "g", requestedPhysicalUnits: 1 }
                ]
              }
            }
          }, "*");
        }
      });
    </script>
  </body></html>`);

  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  expect(frame).toBeTruthy();
  await frame!.setContent(widgetHtml, { waitUntil: "load" });

  await expect(frame!.locator("#kinds")).toHaveText("상품 2종");
  await expect(frame!.locator("#units")).toHaveText("실물 3개");
  await expect(frame!.locator("#items .item")).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});
