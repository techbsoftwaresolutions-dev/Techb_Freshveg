// The rider's doorstep product photo, through the real API — Cloudinary is
// faked at `fetch`, so the test needs no account and checks exactly what is
// sent there (uploads, deletions) and what every viewer gets back.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("delivery product photo", () => {
  let api;
  let seeded;
  let Order;
  let Settings;
  let kumar;
  let ravi;
  let owner; // the fixtures' customer
  const cloud = { uploads: [], destroyed: [], onUpload: null };

  const jpeg = (seed) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`photo-${seed}`)]);
  const fixture = (key) => seeded.orders.find((o) => o.fixture.key === key).order;

  const upload = async (token, id, body, type = "image/jpeg") => {
    const response = await fetch(`${api.base}/orders/${id}/product-photo`, {
      method: "POST",
      headers: { "Content-Type": type, Authorization: `Bearer ${token}` },
      body,
    });
    return { status: response.status, ...(await response.json()) };
  };
  const get = (token, path) => api.call("GET", path, { token });

  let clients = 0;
  async function otpLogin(phone, role) {
    clients += 1;
    const post = async (path, body) => {
      const response = await fetch(`${api.base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.1.0.${clients}` },
        body: JSON.stringify(body),
      });
      return response.json();
    };
    const sent = await post("/auth/otp/request", { phone, role });
    return (await post("/auth/otp/verify", { phone, code: sent.devCode, role })).accessToken;
  }

  before(async () => {
    process.env.DISABLE_JOBS = "true";
    Object.assign(process.env, {
      CLOUDINARY_CLOUD_NAME: "demo-cloud",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    });
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const href = String(url);
      if (href.endsWith("/image/upload")) {
        assert.equal(init.body.get("type"), "authenticated", "photos never go to the public CDN");
        const publicId = `delivery-proof/p${cloud.uploads.length + 1}`;
        cloud.uploads.push(publicId);
        await cloud.onUpload?.();
        return Response.json({ secure_url: `https://x/${publicId}`, public_id: publicId, bytes: 10, width: 800, height: 600, format: "jpg" });
      }
      if (href.endsWith("/image/destroy")) {
        cloud.destroyed.push(init.body.get("public_id"));
        return Response.json({ result: "ok" });
      }
      return realFetch(url, init);
    };

    const { startTestApi } = require("./helpers");
    api = await startTestApi();
    Order = require("../src/modules/orders/order.model");
    Settings = require("../src/modules/settings/settings.model");
    const seed = require("../src/seed/delivery");
    seeded = await seed.seedDelivery();
    kumar = await otpLogin("9000000003", "delivery_partner");
    ravi = await otpLogin("9000000004", "delivery_partner");
    owner = await otpLogin(seed.CUSTOMER.phone, "customer");
  });

  after(async () => api?.stop());

  it("only the assigned rider, only once arrived, only real images", async () => {
    const arrived = fixture("kumar-arrived").id;
    assert.equal((await upload(ravi, arrived, jpeg(1))).status, 403, "another rider");
    assert.equal((await upload(owner, arrived, jpeg(1))).status, 403, "a customer");
    assert.equal((await upload(kumar, fixture("kumar-out").id, jpeg(1))).status, 409, "not arrived yet");
    assert.equal((await upload(kumar, arrived, Buffer.from("<script>"), "image/jpeg")).status, 400, "not an image");
    assert.equal((await upload(kumar, arrived, Buffer.from("GIF89a..."), "image/gif")).status, 400, "not a photo format");
    assert.equal((await upload(kumar, arrived, "{}", "application/json")).status, 400);
    assert.equal(cloud.uploads.length, 0, "nothing refused reached Cloudinary");
  });

  it("the photo can be required before the handover", async () => {
    const id = fixture("kumar-arrived").id;
    await Settings.updateOne({ key: "global" }, { $set: { "delivery.proofPhotoRequired": true } });
    assert.equal((await get(kumar, `/orders/${id}`)).photoRequired, true, "the app is told");
    const { otp } = (await get(owner, `/orders/${id}/track`)).tracking;
    const refused = await api.call("POST", `/orders/${id}/deliver`, { token: kumar, body: { otp } });
    assert.equal(refused.status, 400);
    assert.match(refused.error.message, /product photo/);
    assert.equal((await Order.findById(id)).status, "ARRIVED");
  });

  it("saves, without moving the order, and a retry is not a second upload", async () => {
    const id = fixture("kumar-arrived").id;
    const saved = await upload(kumar, id, jpeg(1));
    assert.equal(saved.status, 201);
    assert.equal(saved.order.status, "ARRIVED", "a photo is not a handover");
    assert.match(saved.order.delivery.productPhoto.url, /^https:\/\/api\.cloudinary\.com\/v1_1\/demo-cloud\/image\/download\?.*expires_at=/);
    assert.ok(saved.order.delivery.productPhoto.uploadedAt);

    const again = await upload(kumar, id, jpeg(1));
    assert.equal(again.status, 200);
    assert.equal(cloud.uploads.length, 1, "same bytes, same photo");

    const stored = (await Order.findById(id)).delivery.productPhoto;
    assert.equal(stored.publicId, "delivery-proof/p1");
    const rider = await require("../src/modules/auth/user.model").findOne({ phone: "9000000003", role: "delivery_partner" });
    assert.equal(String(stored.uploadedBy), rider.id, "the uploader comes from the session, not the request");
  });

  it("a retake replaces it and deletes the unused one", async () => {
    const id = fixture("kumar-arrived").id;
    const retaken = await upload(kumar, id, jpeg(2));
    assert.equal(retaken.status, 201);
    assert.equal((await Order.findById(id)).delivery.productPhoto.publicId, "delivery-proof/p2");
    assert.deepEqual(cloud.destroyed, ["delivery-proof/p1"]);
  });

  it("the customer, staff and rider see the same photo; nobody else does", async () => {
    const id = fixture("kumar-arrived").id;
    const mine = (await get(owner, `/orders/${id}/track`)).order.delivery.productPhoto;
    assert.ok(mine.url);
    assert.equal(mine.uploadedBy, undefined, "customers do not get staff metadata");
    assert.equal(JSON.stringify(mine).includes("publicId"), false);

    const staff = (await get(api.adminToken, `/orders/${id}`)).order.delivery.productPhoto;
    assert.equal(staff.uploadedByName, "Kumar (Delivery)");
    const rider = (await get(kumar, `/orders/${id}`)).order.delivery.productPhoto;
    assert.ok(rider.url);
    // Each read signs the same asset.
    for (const url of [mine.url, staff.url, rider.url]) assert.match(url, /public_id=delivery-proof%2Fp2/);

    assert.equal((await get(api.customerToken, `/orders/${id}/track`)).status, 403, "another customer");
    assert.equal((await get(ravi, `/orders/${id}`)).status, 403, "another rider");
  });

  it("once delivered the photo is fixed", async () => {
    const id = fixture("kumar-arrived").id;
    const { otp } = (await get(owner, `/orders/${id}/track`)).tracking;
    const done = await api.call("POST", `/orders/${id}/deliver`, { token: kumar, body: { otp } });
    assert.equal(done.order.status, "DELIVERED");
    assert.equal((await upload(kumar, id, jpeg(3))).status, 409);
    assert.ok((await get(owner, `/orders/${id}/track`)).order.delivery.productPhoto.url, "still shown to the customer");
    await Settings.updateOne({ key: "global" }, { $set: { "delivery.proofPhotoRequired": false } });
  });

  it("an order cancelled mid-upload keeps no photo and no orphan", async () => {
    const id = fixture("kumar-out").id;
    await api.call("POST", `/orders/${id}/status`, { token: kumar, body: { status: "ARRIVED" } });
    cloud.onUpload = () => Order.updateOne({ _id: id }, { $set: { status: "CANCELLED" } });
    const raced = await upload(kumar, id, jpeg(4));
    cloud.onUpload = null;
    assert.equal(raced.status, 409);
    assert.equal((await Order.findById(id)).delivery.productPhoto?.publicId, undefined);
    assert.equal(cloud.destroyed.at(-1), cloud.uploads.at(-1), "the upload was deleted again");
  });

  it("photos past retention are deleted from Cloudinary and the order", async () => {
    const id = fixture("kumar-arrived").id;
    const { expireDeliveryPhotos } = require("../src/jobs/rules");
    assert.equal((await expireDeliveryPhotos()).deleted, 0, "a fresh photo stays");
    const later = new Date(Date.now() + 91 * 86400000);
    assert.equal((await expireDeliveryPhotos(later)).deleted, 1);
    assert.equal(cloud.destroyed.at(-1), "delivery-proof/p2");
    assert.equal((await get(owner, `/orders/${id}/track`)).order.delivery.productPhoto, null);
  });
});
