import { isTrustedPlanLink } from "./config";

type ExtensionImportResponse = {
  error?: string;
  ok?: boolean;
};

type ExtensionPingResponse = {
  ok?: boolean;
  supportsPlanImport?: boolean;
  version?: string;
};

type PageBridgeMessage = {
  planUrl?: string;
  type?: string;
};

const isTrustedPlanUrl = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return isTrustedPlanLink(url.href);
  } catch {
    return false;
  }
};

const postImportResult = (response: ExtensionImportResponse) => {
  window.postMessage(
    { error: response.error, ok: response.ok === true, type: "DDAKDAMA_EXTENSION_IMPORT_RESULT" },
    window.location.origin,
  );
};

window.addEventListener("message", (event: MessageEvent<PageBridgeMessage>) => {
  if (event.source !== window || event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type === "DDAKDAMA_EXTENSION_PROBE") {
    void chrome.runtime
      .sendMessage({ type: "DDAKDAMA_PING" })
      .then((response: ExtensionPingResponse | undefined) => {
        window.postMessage(
          {
            supportsPlanImport: response?.ok === true && response.supportsPlanImport === true,
            type: "DDAKDAMA_EXTENSION_READY",
            version: response?.version ?? chrome.runtime.getManifest().version,
          },
          window.location.origin,
        );
      })
      .catch(() => {
        window.postMessage(
          {
            supportsPlanImport: false,
            type: "DDAKDAMA_EXTENSION_READY",
            version: chrome.runtime.getManifest().version,
          },
          window.location.origin,
        );
      });
    return;
  }

  if (event.data?.type !== "DDAKDAMA_EXTENSION_IMPORT_PLAN") {
    return;
  }

  if (!isTrustedPlanUrl(event.data.planUrl)) {
    postImportResult({ error: "INVALID_PLAN_LINK", ok: false });
    return;
  }

  void chrome.runtime
    .sendMessage({ type: "DDAKDAMA_IMPORT_PLAN_LINK", planUrl: event.data.planUrl })
    .then((response: ExtensionImportResponse | undefined) => {
      postImportResult({ error: response?.error, ok: response?.ok === true });
    })
    .catch(() => {
      postImportResult({ error: "EXTENSION_UNAVAILABLE", ok: false });
    });
});
