const User = require("../auth/user.model");
const WalletTransaction = require("./walletTransaction.model");
const ApiError = require("../../core/ApiError");

// Every wallet movement goes through here. Nothing else touches
// `User.walletBalance`, which is what keeps the ledger a complete explanation
// of it.

/**
 * Applies a signed amount to a user's balance and records the ledger row.
 *
 * The balance is updated with $inc and read back from the same operation, so
 * two concurrent credits cannot both read the old balance and write the same
 * new one. A debit additionally guards against going negative.
 */
async function apply(userId, amount, { reason, note, order, orderCode, refType, refId, actor } = {}) {
  if (!amount || Number.isNaN(Number(amount))) throw ApiError.badRequest("Wallet amount is required");
  if (!Number.isInteger(amount)) throw ApiError.badRequest("Wallet amount must be integer paise");

  const filter = { _id: userId };
  // Refuse the debit atomically rather than checking first and racing.
  if (amount < 0) filter.walletBalance = { $gte: Math.abs(amount) };

  const user = await User.findOneAndUpdate(
    filter,
    { $inc: { walletBalance: amount } },
    { new: true }
  );

  if (!user) {
    const exists = await User.exists({ _id: userId });
    if (!exists) throw ApiError.notFound("Customer not found");
    throw ApiError.badRequest("Not enough wallet balance");
  }

  await WalletTransaction.create({
    user: userId,
    amount,
    balanceAfter: user.walletBalance,
    reason: reason || "adjustment",
    note: note || "",
    order,
    orderCode: orderCode || "",
    refType: refType || "",
    refId,
    actor: actor?.id,
    actorName: actor?.name || "",
  });

  return { balance: user.walletBalance, amount };
}

const credit = (userId, amount, options) => apply(userId, Math.abs(amount), options);
const debit = (userId, amount, options) => apply(userId, -Math.abs(amount), options);

async function balanceOf(userId) {
  const user = await User.findById(userId).select("walletBalance");
  return user?.walletBalance || 0;
}

async function history(userId, { limit = 50 } = {}) {
  return WalletTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
}

// Sums the ledger and compares it with the stored balance. A mismatch means
// something wrote the balance directly — worth surfacing in an admin report
// rather than discovering during a dispute.
async function reconcile(userId) {
  const [totals] = await WalletTransaction.aggregate([
    { $match: { user: new (require("mongoose").Types.ObjectId)(String(userId)) } },
    { $group: { _id: null, sum: { $sum: "$amount" } } },
  ]);

  const stored = await balanceOf(userId);
  const ledger = totals?.sum || 0;
  return { stored, ledger, drift: stored - ledger, ok: stored === ledger };
}

module.exports = { apply, credit, debit, balanceOf, history, reconcile };
