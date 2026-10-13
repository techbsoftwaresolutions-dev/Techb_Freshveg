"use client";

import Link from "next/link";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";

// Refer & earn, on the API's own rules (referral.service): a friend's code can
// be used once, before your first order, and both rewards land in the wallet
// when that first order is delivered.
export default function ReferPage() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/account/refer");
  }, [ready, signedIn, router]);

  const load = useCallback(() => {
    api
      .get("/referrals/me")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  async function claim(event) {
    event.preventDefault();
    setClaiming(true);
    setError("");
    try {
      const result = await api.post("/referrals/claim", { code: code.trim() });
      setClaimed(result.message);
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  }

  async function share() {
    const text = `Get ${rupees(data.friendReward)} off your first The Farmers Basket order — use my code ${data.code}.`;
    try {
      if (navigator.share) await navigator.share({ title: "The Farmers Basket", text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }

  if (!ready || (!data && !error)) {
    return (
      <div className="wrap">
        <div className="page-loading">
          <MorphingSquare message="Loading…" />
        </div>
      </div>
    );
  }

  return (
    <div className="wrap wrap-narrow">
      <header className="page-title">
        <Link href="/account" className="section-link">
          ← Back to account
        </Link>
        <h1>Refer &amp; earn</h1>
      </header>

      {!data ? (
        <p className="notice error">{error}</p>
      ) : !data.enabled ? (
        <p className="notice warn">Referrals are paused right now — check back soon.</p>
      ) : (
        <>
          <section className="panel">
            <h3>Invite friends, earn {rupees(data.reward)}</h3>
            <p className="muted-line">
              Your friend gets {rupees(data.friendReward)} and you get {rupees(data.reward)} in your wallet when their first
              order{data.minFirstOrderValue ? ` of ${rupees(data.minFirstOrderValue)} or more` : ""} is delivered.
            </p>
            <div className="stat-tile-row" style={{ marginTop: 12 }}>
              <strong className="stat-code">{data.code}</strong>
              <button type="button" className="btn primary sm" onClick={share}>
                {copied ? "Copied!" : "Share my code"}
              </button>
            </div>
          </section>

          <div className="stat-tiles">
            <div className="stat-tile">
              <span>Friends joined</span>
              <strong>{data.invited}</strong>
            </div>
            <div className="stat-tile">
              <span>Earned</span>
              <strong>{rupees(data.earned)}</strong>
            </div>
          </div>

          {data.friends.length ? (
            <section className="panel">
              <h3>Your friends</h3>
              <div className="list-rows">
                {data.friends.map((friend, index) => (
                  <div key={index} className="list-row">
                    <span className="list-row-main">
                      <strong>{friend.name}</strong>
                      <span>{friend.status === "rewarded" ? "Rewarded" : "Awaiting their first order"}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <h3>Got a friend&apos;s code?</h3>
            <p className="muted-line">Use it before your first order.</p>
            <form onSubmit={claim}>
              {error ? <p className="notice error">{error}</p> : null}
              {claimed ? <p className="notice save">{claimed}</p> : null}
              <div className="field">
                <label htmlFor="ref-code">Referral code</label>
                <input
                  id="ref-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                />
              </div>
              <button className="btn primary" disabled={claiming || code.trim().length < 4}>
                {claiming ? "Applying…" : "Apply code"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
