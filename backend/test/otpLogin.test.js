// OTP sign-in hardening: the per-number request cap and the fixed store-review
// logins. Run with `npm test`.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("OTP sign-in limits and review logins", () => {
  let api;
  let clients = 0;
  const post = async (path, body) => {
    clients += 1; // a fresh address each time, so only the per-number cap applies
    const response = await fetch(`${api.base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.8.0.${clients}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, ...(await response.json()) };
  };

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    process.env.REVIEW_LOGINS = "customer:9822200001:246810";
    const { startTestApi } = require("./helpers");
    api = await startTestApi();
  });

  after(async () => {
    delete process.env.REVIEW_LOGINS;
    await api?.stop();
  });

  it("caps codes per number even from changing addresses", async () => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await post("/auth/otp/request", { phone: "9822200009" })).status, 200);
    }
    const capped = await post("/auth/otp/request", { phone: "9822200009" });
    assert.equal(capped.status, 429);
    assert.equal((await post("/auth/otp/request", { phone: "9822200008" })).status, 200, "other numbers unaffected");
  });

  it("a review number signs in with its fixed code only, and no code is sent or shown", async () => {
    const sent = await post("/auth/otp/request", { phone: "9822200001" });
    assert.equal(sent.status, 200);
    assert.equal(sent.devCode, undefined);
    assert.equal((await post("/auth/otp/verify", { phone: "9822200001", code: "000000" })).status, 400);
    const login = await post("/auth/otp/verify", { phone: "9822200001", code: "246810" });
    assert.equal(login.status, 200);
    assert.equal(login.user.role, "customer");
    // Listed as a customer review login only — not as a rider.
    assert.equal((await post("/auth/otp/verify", { phone: "9822200001", code: "246810", role: "delivery_partner" })).status, 400);
  });
});
