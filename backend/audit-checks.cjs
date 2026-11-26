// Read-only audit probes: model methods are replaced in this process; no DB connection.
const assert = require('node:assert/strict');
const Payment = require('./src/modules/payments/payment.model');
const payments = require('./src/modules/payments/payment.service');
const inventory = require('./src/modules/inventory/inventory.service');
const loyalty = require('./src/modules/loyalty/loyalty.service');
const referrals = require('./src/modules/referrals/referral.service');
const notifications = require('./src/modules/notifications/notification.service');
const orders = require('./src/modules/orders/order.service');
async function main() {
  const payment = { provider: 'none', status: 'created', amount: 12300, save: async () => {} };
  Payment.findById = async () => payment;
  await payments.confirm('audit', {});
  assert.equal(payment.status, 'captured');
  console.log('REPRODUCED: manual payment captured with no payment proof');
  Payment.findOne = async () => payment;
  const retry = await payments.initiate({ payment: {} }, { idempotencyKey: 'audit' });
  assert.equal(retry.payment, undefined);
  console.log('REPRODUCED: idempotent retry omits expected payment envelope');
  let dispatches = 0, rewards = 0;
  inventory.dispatch = async () => { dispatches++; };
  loyalty.earn = async () => { rewards++; return { points: 1 }; };
  referrals.settleForOrder = async () => {};
  notifications.notify = async () => {};
  const order = { _id: 'audit', code: 'AUDIT', customer: 'audit', store: 'audit',
    status: 'RETURN_REQUESTED', statusHistory: [], delivery: {}, payment: { method: 'upi' },
    pricing: { total: 12300 }, items: [{ variant: 'audit', quantity: 1 }], save: async () => {} };
  await orders.transition(order, 'DELIVERED', { role: 'admin' }, 'Return declined');
  assert.equal(dispatches, 1); assert.equal(rewards, 1);
  console.log('REPRODUCED: declining return dispatches stock and credits rewards again');
  dispatches = 0;
  order.status = 'OUT_FOR_DELIVERY';
  order.delivery = { partner: 'another-rider', otp: '1234' };
  await orders.transition(order, 'DELIVERED', { id: 'wrong-rider', role: 'delivery_partner' });
  assert.equal(dispatches, 1); assert.equal(order.delivery.otpVerifiedAt, undefined);
  console.log('REPRODUCED: generic status transition allows wrong rider delivery without OTP');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
