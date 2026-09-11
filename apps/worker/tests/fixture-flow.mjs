// `pnpm test:fixture-flow http://127.0.0.1:8798` must target that explicit
// fixture Worker instead of silently falling back to the default port.
const cliOrigin = process.argv.slice(2).at(-1);
const origin = (cliOrigin ?? process.env.DDAKDAMA_FIXTURE_ORIGIN ?? "http://127.0.0.1:8792").replace(/\/$/, "");

const request = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${payload.error ?? "REQUEST_FAILED"}`);
  return payload;
};

const installation = await request("/api/mobile/installations/register", { method: "POST", body: {} });
const aiUnavailable = await fetch(`${origin}/api/ai/shopping-list`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ instruction: "생수와 비빔면 목록 정리", currentList: "생수 1L 12병" }),
});
const aiUnavailableBody = await aiUnavailable.json();
if (aiUnavailable.status !== 503 || aiUnavailableBody.error !== "AI_PROVIDER_UNAVAILABLE") {
  throw new Error("AI_UNAVAILABLE_CONTRACT_MISSING");
}
const created = await request("/api/plans", {
  method: "POST",
  body: { shoppingList: "생수 1L 12병\n비빔면 5개입" },
});
const planToken = created.accessToken;
const resolved = await request(`/api/plans/${created.plan.id}/resolve`, {
  method: "POST",
  token: planToken,
  body: {},
});
if (resolved.fixture !== true || resolved.plan.items.some((item) => item.candidates.length !== 1)) {
  throw new Error("FIXTURE_CANDIDATES_MISSING");
}

const selectedCandidateIds = Object.fromEntries(
  resolved.plan.items.map((item) => [item.id, item.candidates[0].id]),
);
const selected = await request(`/api/plans/${created.plan.id}`, {
  method: "PATCH",
  token: planToken,
  body: { expectedVersion: resolved.plan.version, selectedCandidateIds },
});
const prepared = await request(`/api/plans/${created.plan.id}/finalize-affiliate-links`, {
  method: "POST",
  token: planToken,
  body: {},
});
if (prepared.fallback !== "CANONICAL_URL") throw new Error("CANONICAL_FALLBACK_MISSING");

const preflight = await request(`/api/plans/${created.plan.id}/preflight`, {
  method: "POST",
  token: planToken,
  body: {},
});
if (!preflight.ok || !preflight.preflightToken) throw new Error("PREFLIGHT_TOKEN_MISSING");

const execution = await request("/api/executions", {
  method: "POST",
  token: planToken,
  body: { planId: selected.plan.id, planVersion: prepared.plan.version, allowCanonicalFallback: true, userApproved: true, preflightToken: preflight.preflightToken },
});
const claimLink = await request(`/api/executions/${execution.execution.id}/claim-link`, {
  method: "POST",
  token: planToken,
  body: {},
});
const claimToken = new URL(claimLink.appLink).searchParams.get("claim");
if (!claimToken) throw new Error("CLAIM_TOKEN_MISSING");

const claimed = await request(`/api/executions/${execution.execution.id}/claim`, {
  method: "POST",
  token: installation.deviceToken,
  body: { claimToken },
});
for (const item of claimed.execution.items) {
  await request(`/api/executions/${claimed.execution.id}/items/${item.id}`, {
    method: "PATCH",
    token: installation.deviceToken,
    body: { status: "ADDED", message: null },
  });
}
const final = await request(`/api/executions/${execution.execution.id}`, {
  token: installation.deviceToken,
});
if (final.execution.status !== "COMPLETED" || final.execution.items.some((item) => item.status !== "ADDED")) {
  throw new Error("FIXTURE_EXECUTION_NOT_COMPLETED");
}

console.log(JSON.stringify({
  fixtureItems: final.execution.items.length,
  fallback: prepared.fallback,
  aiUnavailable: aiUnavailableBody.error,
  executionStatus: final.execution.status,
}));
