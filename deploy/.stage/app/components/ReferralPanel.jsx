"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";
import { shareInvite } from "@/lib/referral";

// "Refer & earn": the customer's own code and invite link, how many friends
// they have brought in, and — until their first order — a place to enter a
// friend's code. All numbers come from the API and the store's referral
// settings; nothing here is hard-coded.
export default function ReferralPanel({ code, onChanged }) {
  const [info, setInfo] = useState(null);
  const [note, setNote] = useState("");
  const [friendCode, setFriendCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.get("/referrals/me").then(setInfo).catch(() => {});
  }, []);
  useEffect(load, [load]);

  if (!code || (info && !info.enabled)) return null;

  const flash = (text) => {
    setNote(text);
    setTimeout(() => setNote(""), 2200);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      flash("Code copied");
    } catch {
      flash("");
    }
  }

  async function share() {
    const result = await shareInvite(code, info);
    if (result === "copied") flash("Invite link copied");
  }

  async function claim(event) {
    event.preventDefault();
    const value = friendCode.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/referrals/claim", { code: value });
      flash(res.message || "Code applied");
      setFriendCode("");
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const reward = info ? rupees(info.reward) : "";
  const friend = info ? rupees(info.friendReward) : "";
  const min = info?.minFirstOrderValue ? rupees(info.minFirstOrderValue) : "";

  return (
    <section className="ref-panel" aria-label="Refer and earn">
      <div className="ref-head">
        <div>
          <h3>Refer &amp; earn</h3>
          {info ? (
            <p>
              Share your code. When a friend signs up and their first order{min ? ` (${min}+)` : ""} is delivered,
              you earn <strong>{reward}</strong> and they get <strong>{friend}</strong> in the wallet.
            </p>
          ) : null}
        </div>
      </div>

      <div className="ref-code-row">
        <button type="button" className="ref-code" onClick={copy} title="Tap to copy">
          <span>Your code</span>
          <strong>{code}</strong>
        </button>
        <button type="button" className="ref-btn" onClick={copy}>Copy</button>
        <button type="button" className="ref-btn primary" onClick={share}>Share invite</button>
      </div>
      {note ? <p className="ref-note" role="status">{note}</p> : null}

      {info ? (
        <div className="ref-stats">
          <div><strong>{info.invited}</strong><span>Friends joined</span></div>
          <div><strong>{info.rewardedCount}</strong><span>Rewarded</span></div>
          <div><strong>{rupees(info.earned)}</strong><span>Earned</span></div>
        </div>
      ) : null}

      {info?.friends?.length ? (
        <ul className="ref-friends">
          {info.friends.slice(0, 6).map((friendRow, index) => (
            <li key={index}>
              <span>{friendRow.name}</span>
              <em className={friendRow.status}>{friendRow.status === "rewarded" ? "Rewarded" : friendRow.status === "pending" ? "Waiting for first order" : "Not eligible"}</em>
            </li>
          ))}
        </ul>
      ) : null}

      {info?.canClaim ? (
        <form className="ref-claim" onSubmit={claim}>
          <label htmlFor="ref-claim-input">Have a friend&apos;s code?</label>
          <div>
            <input
              id="ref-claim-input"
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
              placeholder="Enter code"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="ref-btn primary" disabled={!friendCode.trim() || busy}>{busy ? "Applying…" : "Apply"}</button>
          </div>
          {error ? <p className="ref-bad">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
