"use client";

import Link from "next/link";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";

// Refer & Earn, on the API's rules (backend referrals/referral.service): a
// friend can be referred once, before their first order; the referrer earns
// a coupon each time that friend's qualifying purchases reach a milestone.
// Every number here — counts, progress, rewards — comes from the API.
const STATUS = {
  pending: { label: "Joined", tone: "brand" },
  active: { label: "Shopping", tone: "save" },
  void: { label: "Closed", tone: "danger" },
};
const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;

export default function ReferPage() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const [data, setData] = useState(null);
  const [friends, setFriends] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimed, setClaimed] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/account/refer");
  }, [ready, signedIn, router]);

  const load = useCallback(() => {
    setError("");
    api.get("/referrals/me").then(setData).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  useEffect(() => {
    if (!signedIn) return;
    api
      .get("/referrals/me/friends", { page, limit: 10 })
      .then(setFriends)
      .catch(() => setFriends({ items: [], meta: null }));
  }, [signedIn, page]);

  const link = data ? data.shareUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${data.code}` : "";

  async function copy(what, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }

  async function share() {
    const text = `Join me on The Farmers Basket — sign up with my code ${data.code}.`;
    try {
      if (navigator.share) await navigator.share({ title: "The Farmers Basket", text, url: link });
      else await copy("link", `${text} ${link}`);
    } catch {
      // Share sheet dismissed.
    }
  }

  async function claim(event) {
    event.preventDefault();
    setClaiming(true);
    setClaimError("");
    try {
      const result = await api.post("/referrals/claim", { code: code.trim() });
      setClaimed(result.message);
      setCode("");
      load();
    } catch (err) {
      setClaimError(err.message);
    } finally {
      setClaiming(false);
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

  const rules = data?.rules;
  const stats = data?.stats;

  return (
    <div className="wrap wrap-narrow">
      <header className="page-title">
        <Link href="/account" className="section-link">
          ← Back to account
        </Link>
        <h1>Refer &amp; earn</h1>
      </header>

      {!data ? (
        <p className="notice error">
          {error}{" "}
          <button type="button" className="btn sm" onClick={load}>
            Retry
          </button>
        </p>
      ) : (
        <>
          {!data.enabled ? (
            <p className="notice warn">
              Referrals are paused right now. Your friends and coupons are safe, and progress picks up when we restart.
            </p>
          ) : null}

          <section className="panel">
            <h3>Invite friends, earn coupons</h3>
            <ol className="ref-steps">
              <li>Share your code or link. Your friend signs up with it before their first order.</li>
              <li>
                Every delivered order of theirs worth {rupees(rules.minQualifyingOrderValue)} or more (items, after offers)
                counts.
              </li>
              <li>
                You earn{" "}
                {rules.milestones.map((m, i) => (
                  <span key={m.purchases}>
                    {i ? (i === rules.milestones.length - 1 && !rules.repeatEvery ? " and " : ", ") : ""}
                    {rupees(m.reward)} at their {nth(m.purchases)} purchase
                  </span>
                ))}
                {rules.repeatEvery ? `, then ${rupees(rules.repeatReward)} every ${rules.repeatEvery} more` : ""}.
                {rules.welcomeReward ? ` They get a ${rupees(rules.welcomeReward)} welcome coupon on their first.` : ""}
              </li>
              <li>
                Coupons land in <Link href="/account/coupons">My coupons</Link> and last {rules.couponExpiryDays} days.
              </li>
            </ol>

            <div className="ref-share">
              <div className="stat-tile-row">
                <strong className="stat-code">{data.code}</strong>
                <button type="button" className="btn sm" onClick={() => copy("code", data.code)}>
                  {copied === "code" ? "Copied!" : "Copy code"}
                </button>
              </div>
              <div className="ref-share-row">
                <input type="text" readOnly value={link} aria-label="Your referral link" onFocus={(e) => e.target.select()} />
                <button type="button" className="btn sm" onClick={() => copy("link", link)}>
                  {copied === "link" ? "Copied!" : "Copy link"}
                </button>
                <button type="button" className="btn primary sm" onClick={share} disabled={!data.enabled}>
                  Share
                </button>
              </div>
            </div>
          </section>

          <div className="stat-tiles">
            <div className="stat-tile">
              <span>Friends referred</span>
              <strong>{stats.referred}</strong>
              <em>{stats.friendsPurchased} have shopped</em>
            </div>
            <div className="stat-tile">
              <span>Qualifying purchases</span>
              <strong>{stats.qualifyingPurchases}</strong>
            </div>
            <div className="stat-tile">
              <span>Coupons earned</span>
              <strong>{stats.couponsEarned}</strong>
              <em>{rupees(stats.earnedValue)} in total</em>
            </div>
            <Link href="/account/coupons" className="stat-tile">
              <span>Ready to use</span>
              <strong>{stats.couponsAvailable}</strong>
              <em>View coupons →</em>
            </Link>
          </div>

          <section className="panel">
            <h3>Your friends</h3>
            {friends === null ? (
              <MorphingSquare message="Loading…" />
            ) : !friends.items.length ? (
              <p className="muted-line">No friends yet — share your code to get started.</p>
            ) : (
              <>
                {friends.items.map((friend) => {
                  const status = STATUS[friend.status] || STATUS.pending;
                  const next = friend.nextMilestone;
                  return (
                    <div key={friend.id} className="ref-friend">
                      <div className="ref-friend-head">
                        <strong>{friend.name}</strong>
                        <span className={`pill ${status.tone}`}>{status.label}</span>
                      </div>
                      <small>
                        Joined {new Date(friend.referredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {friend.qualifyingPurchases
                          ? next
                            ? `${friend.qualifyingPurchases} of ${next.purchases} qualifying purchases`
                            : `${friend.qualifyingPurchases} qualifying purchases · all rewards earned`
                          : "No qualifying purchase yet"}
                      </small>
                      <div
                        className="ref-progress"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={friend.percent}
                        aria-label={`${friend.name}'s progress`}
                      >
                        <span style={{ width: `${friend.percent}%` }} />
                      </div>
                      <small>
                        {friend.status === "void"
                          ? "This referral is closed."
                          : next
                            ? `Next: ${next.purchases} purchase${next.purchases === 1 ? "" : "s"} → ${rupees(next.reward)} reward (${next.remaining} to go)`
                            : "Milestones complete."}
                        {friend.rewardsEarned ? ` · ${friend.rewardsEarned} reward${friend.rewardsEarned === 1 ? "" : "s"} earned` : ""}
                      </small>
                    </div>
                  );
                })}
                {friends.meta?.pages > 1 ? (
                  <div className="ref-share-row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                    <button type="button" className="btn sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      ← Newer
                    </button>
                    <span className="muted-line">
                      Page {friends.meta.page} of {friends.meta.pages}
                    </span>
                    <button type="button" className="btn sm" disabled={page >= friends.meta.pages} onClick={() => setPage((p) => p + 1)}>
                      Older →
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {data.canClaim || claimed ? (
            <section className="panel">
              <h3>Got a friend&apos;s code?</h3>
              <p className="muted-line">Use it before your first order. It can&apos;t be changed later.</p>
              <form onSubmit={claim}>
                {claimError ? <p className="notice error">{claimError}</p> : null}
                {claimed ? <p className="notice save">{claimed}</p> : null}
                {!claimed ? (
                  <>
                    <div className="field">
                      <label htmlFor="ref-code">Referral code</label>
                      <input
                        id="ref-code"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                        autoComplete="off"
                        maxLength={16}
                      />
                    </div>
                    <button className="btn primary" disabled={claiming || code.trim().length < 4}>
                      {claiming ? "Applying…" : "Apply code"}
                    </button>
                  </>
                ) : null}
              </form>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
