"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { useAuth } from "@/components/Providers";
import { rupees } from "@/lib/format";

// The deletion itself, for anyone who no longer has the app: sign in with
// the account's phone number, see what stops it or what is lost, type DELETE.
// Same API as the app (backend accountDeletion.service.js).
export default function AccountDeletionPanel() {
  const { user, ready, signedIn, signOut } = useAuth();
  const [check, setCheck] = useState(null);
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!signedIn || user?.role !== "customer") return;
    api.get("/auth/me/deletion").then(setCheck).catch((err) => setError(err.message));
  }, [signedIn, user?.role]);

  async function remove(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.post("/auth/me/deletion", { confirm: typed, acknowledge: acknowledged, source: "web" });
      setDone(result.deletion);
      signOut();
    } catch (err) {
      setError(err.message);
      api.get("/auth/me/deletion").then(setCheck).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (done) {
    body = (
      <>
        <p><strong>Your account has been deleted.</strong> You have been signed out on this device, and every other session has ended.</p>
        <p>Reference: <strong>{done.reference}</strong> — quote it if you contact us about the deletion.</p>
      </>
    );
  } else if (!ready) {
    body = <p>Loading…</p>;
  } else if (!signedIn) {
    body = (
      <>
        <p>Sign in with the mobile number of the account you want to delete. We send a one-time code to that number to confirm it is yours.</p>
        <p><Link className="btn primary" href="/login?next=/account-deletion">Sign in to delete my account</Link></p>
      </>
    );
  } else if (user.role !== "customer") {
    body = <p>This page deletes shopping accounts. Delivery staff: use <strong>Profile → Legal &amp; account</strong> in the delivery app, or ask your store.</p>;
  } else if (!check) {
    body = error ? <p className="legal-error">{error}</p> : <p>Checking your account…</p>;
  } else if (check.blockers.length) {
    body = (
      <>
        <p>Signed in as +91 {user.phone}. Your account can&apos;t be deleted yet:</p>
        <ul className="legal-list">
          {check.blockers.map((b) => <li key={`${b.kind}-${b.ref}`}>{b.message}</li>)}
        </ul>
        <p><Link href="/orders">Go to my orders</Link> · <Link href="/help">Contact support</Link></p>
      </>
    );
  } else {
    const ready = typed.trim().toUpperCase() === "DELETE" && (acknowledged || !check.warnings.length);
    body = (
      <form onSubmit={remove}>
        <p>Signed in as +91 {user.phone}. Deleting cannot be undone.</p>
        {check.warnings.length ? (
          <>
            <p>You will lose:</p>
            <ul className="legal-list">
              {check.warnings.map((w) => (
                <li key={w.kind}>
                  {w.kind === "wallet" ? `Wallet balance of ${rupees(w.amount)}` : w.kind === "points" ? `${w.points} loyalty points` : `${w.count} unused reward coupon(s)`}
                </li>
              ))}
            </ul>
            <p>
              <label>
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />{" "}
                I understand these are forfeited and cannot be restored.
              </label>
            </p>
          </>
        ) : null}
        <p>
          <label htmlFor="confirm-delete">Type DELETE to confirm</label>
          <br />
          <input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder="DELETE" />
        </p>
        {error ? <p className="legal-error" role="alert">{error}</p> : null}
        <p><button type="submit" className="btn danger-outline" disabled={!ready || busy}>{busy ? "Deleting…" : "Delete my account"}</button></p>
      </form>
    );
  }

  return (
    <section id="delete-now" className="legal-section">
      <h2>Delete your account now</h2>
      {body}
    </section>
  );
}
