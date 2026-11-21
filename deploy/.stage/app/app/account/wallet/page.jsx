"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";
import { addMoneyWithRazorpay } from "@/lib/razorpay";
import { IconBack, IconWallet } from "@/components/AccountIcons";

// What each ledger reason means to a customer.
const QUICK = [100, 200, 500, 1000]; // rupees

const REASON = {
  refund: "Refund",
  cashback: "Cashback",
  referral: "Referral reward",
  topup: "Money added",
  order_payment: "Used on order",
  adjustment: "Adjustment",
  expiry: "Expired",
};

function when(date) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function WalletPage() {
  const router = useRouter();
  const { ready, signedIn, refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState({ tone: "", text: "" });

  function load() {
    return api
      .get("/auth/me/wallet")
      .then((d) => {
        setData(d);
        refreshUser?.();
      })
      .catch((err) => setError(err.message));
  }

  async function addMoney(event) {
    event.preventDefault();
    const rupeesWanted = Number(amount);
    if (!rupeesWanted || rupeesWanted < 10) return setAddMsg({ tone: "error", text: "Add at least ₹10." });
    if (rupeesWanted > 10000) return setAddMsg({ tone: "error", text: "You can add up to ₹10,000 at a time." });
    setAdding(true);
    setAddMsg({ tone: "", text: "" });
    try {
      const result = await addMoneyWithRazorpay(Math.round(rupeesWanted) * 100);
      if (result.paid) {
        setAmount("");
        setAddMsg({ tone: "ok", text: `${rupees(Math.round(rupeesWanted) * 100)} added to your wallet.` });
        await load();
      }
    } catch (err) {
      setAddMsg({ tone: "error", text: err.message });
    } finally {
      setAdding(false);
    }
  }

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/account/wallet");
  }, [ready, signedIn, router]);

  useEffect(() => {
    if (!signedIn) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const head = (
    <div className="cat-mobile-head acct-head">
      <Link href="/account" aria-label="Back" className="cat-mobile-btn">
        <IconBack width={22} height={22} strokeWidth={2} />
      </Link>
      <h1 className="cat-mobile-title">Wallet</h1>
    </div>
  );

  if (!data && !error) {
    return (
      <div className="wrap">
        {head}
        <div className="page-loading"><MorphingSquare message="Loading…" /></div>
      </div>
    );
  }

  return (
    <div className="wrap wrap-narrow wallet-page">
      {head}
      <header className="page-title wallet-desk-title">
        <h1>Wallet</h1>
      </header>

      {error ? <p className="notice error">{error}</p> : null}

      {data ? (
        <>
          <section className="wallet-hero">
            <span className="wallet-hero-icon" aria-hidden="true"><IconWallet width={26} height={26} /></span>
            <div>
              <span className="wallet-hero-label">Available balance</span>
              <strong className="wallet-hero-amount">{rupees(data.balance)}</strong>
            </div>
          </section>
          <form className="panel wallet-add" onSubmit={addMoney}>
            <h3>Add money</h3>
            <div className="wallet-add-input">
              <span aria-hidden="true">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min="10"
                max="10000"
                step="1"
                placeholder="Enter amount"
                aria-label="Amount in rupees"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 5));
                  setAddMsg({ tone: "", text: "" });
                }}
              />
            </div>
            <div className="wallet-add-chips">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={Number(amount) === q ? "on" : ""}
                  onClick={() => {
                    setAmount(String(q));
                    setAddMsg({ tone: "", text: "" });
                  }}
                >
                  + ₹{q}
                </button>
              ))}
            </div>
            {addMsg.text ? <p className={`wallet-add-msg ${addMsg.tone}`} role="status">{addMsg.text}</p> : null}
            <button className="btn primary block wallet-add-btn" disabled={adding || !amount}>
              {adding ? "Opening payment…" : amount ? `Add ₹${Number(amount).toLocaleString("en-IN")}` : "Add money"}
            </button>
            <p className="wallet-add-note">Pay securely with UPI, card or net banking via Razorpay.</p>
          </form>

          <p className="wallet-how">
            Use your balance at checkout — tick <strong>Use wallet balance</strong> in the order summary. Refunds and
            cashback land here automatically.
          </p>

          <section className="panel wallet-history">
            <h3>History</h3>
            {data.transactions.length ? (
              <ul>
                {data.transactions.map((t) => (
                  <li key={t.id}>
                    <div>
                      <strong>{REASON[t.reason] || "Wallet"}</strong>
                      <span>
                        {when(t.createdAt)}
                        {t.orderCode ? (
                          <>
                            {" · "}
                            {t.order ? <Link href={`/orders/${t.order}`}>{t.orderCode}</Link> : t.orderCode}
                          </>
                        ) : null}
                      </span>
                      {t.note && t.reason === "adjustment" ? <em>{t.note}</em> : null}
                    </div>
                    <b className={t.amount >= 0 ? "plus" : "minus"}>
                      {t.amount >= 0 ? "+ " : "− "}
                      {rupees(Math.abs(t.amount))}
                    </b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-line">No wallet activity yet.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
