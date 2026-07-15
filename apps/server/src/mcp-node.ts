import {
  authenticateGrant,
  completePairing,
  createHandoff,
  handoffStatus,
  revokeConnectionGrant,
} from "./store.js";
import {
  createMcpServer as createSharedMcpServer,
  type McpStore,
} from "./mcp.js";
import { LEGACY_WIDGET_URIS, WIDGET_URI, widgetHtml } from "./widget.js";

const store: McpStore = {
  authenticateGrant,
  completePairing,
  createHandoff,
  handoffStatus,
  revokeConnectionGrant,
};

export function createMcpServer(
  { pairingClientKey = "unknown" }: { pairingClientKey?: string } = {},
) {
  return createSharedMcpServer({
    pairingClientKey,
    store,
    widgetHtml,
    widgetUri: WIDGET_URI,
    legacyWidgetUris: LEGACY_WIDGET_URIS,
  });
}
