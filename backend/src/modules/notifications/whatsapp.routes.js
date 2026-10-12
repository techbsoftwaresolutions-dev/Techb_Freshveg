const express = require("express");
const asyncHandler = require("../../core/asyncHandler");
const whatsapp = require("./whatsapp");
const whatsappService = require("./whatsapp.service");

// Meta's WhatsApp webhook: GET is the one-time subscription handshake, POST
// carries message status receipts (sent / delivered / read / failed).
//
// These say whether a *WhatsApp message* reached the customer's phone — not
// whether their groceries arrived. Order status only changes through the
// order workflow.

const router = express.Router();

router.get("/", (req, res) => {
  const { verifyToken } = whatsapp.settings();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  if (verifyToken && mode === "subscribe" && token === verifyToken) {
    return res.status(200).type("text/plain").send(String(req.query["hub.challenge"] || ""));
  }
  return res.sendStatus(403);
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    // Authenticity comes from the signature over the exact bytes Meta sent;
    // app.js keeps them as req.rawBody for webhook paths.
    if (!whatsapp.verifySignature(req.rawBody, req.headers["x-hub-signature-256"])) {
      return res.sendStatus(401);
    }

    let updated = 0;
    for (const entry of Array.isArray(req.body?.entry) ? req.body.entry : []) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        for (const status of Array.isArray(change?.value?.statuses) ? change.value.statuses : []) {
          const result = await whatsappService.applyStatusCallback(status);
          if (result.updated) updated += 1;
        }
      }
    }

    // 200 once the signature is good, even for receipts we ignore: Meta
    // retries anything else, and a repeat is harmless (receipts only move a
    // message forward).
    res.json({ success: true, updated });
  })
);

module.exports = router;
