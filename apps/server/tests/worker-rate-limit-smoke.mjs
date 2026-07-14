const origin = (process.env.DDAKDAMA_TEST_ORIGIN ?? "http://127.0.0.1:8790").replace(/\/$/, "");
const clientKey = `smoke-${crypto.randomUUID()}`;

const statuses = [];
for (let index = 0; index < 11; index += 1) {
  const response = await fetch(`${origin}/api/pairing/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": clientKey,
    },
    body: "{}",
  });
  statuses.push(response.status);
}

if (statuses.slice(0, 10).some((status) => status !== 201) || statuses[10] !== 429) {
  throw new Error(`Pairing rate limit failed: ${statuses.join(",")}`);
}

console.log(JSON.stringify({ allowed: statuses.slice(0, 10).length, blockedStatus: statuses[10] }));
