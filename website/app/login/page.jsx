"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useBranding } from "@/components/Providers";
import { pendingReferral } from "@/lib/client-api";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="wrap"><div className="empty">Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const { requestOtp, verifyOtp, signedIn } = useAuth();
  const brand = useBranding();

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  // A friend's code from a referral link, applied with the sign-in.
  const [referral, setReferral] = useState(null);
  const [referralNote, setReferralNote] = useState("");
  useEffect(() => setReferral(pendingReferral()), []);
  // "filling" while the code counts up into the box, "done" once it is in.
  const [autoFill, setAutoFill] = useState("");
  const timer = useRef(null);
  const fillFrame = useRef(null);

  const stopFill = () => clearInterval(fillFrame.current);
  useEffect(() => stopFill, []);

  // Fills the box by itself: the digits count up — 000001, 000002, … — and
  // land on the real code, so the shopper sees it being fetched. A timer, not
  // animation frames: those pause while the tab is in the background (the
  // shopper glancing at their messages), and the code would never arrive.
  function fillCode(target) {
    if (!/^\d{6}$/.test(String(target || ""))) return;
    stopFill();
    const goal = Number(target);
    const started = Date.now();
    const DURATION = 900;
    setAutoFill("filling");
    fillFrame.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / DURATION);
      if (t >= 1) {
        stopFill();
        setCode(String(target));
        setAutoFill("done");
        return;
      }
      const eased = 1 - Math.pow(1 - t, 3);
      setCode(String(Math.max(1, Math.round(goal * eased))).padStart(6, "0"));
    }, 30);
  }

  // Android Chrome: read the code straight from the incoming SMS (WebOTP),
  // once an SMS provider sends messages ending "@thefarmersbasket.in #123456".
  useEffect(() => {
    if (step !== "code" || typeof window === "undefined" || !("OTPCredential" in window)) return undefined;
    const abort = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: abort.signal })
      .then((otp) => otp?.code && fillCode(otp.code))
      .catch(() => {});
    return () => abort.abort();
  }, [step]);

  useEffect(() => {
    if (signedIn) router.replace(next);
  }, [signedIn, next, router]);

  useEffect(() => () => clearInterval(timer.current), []);

  function countdown(seconds) {
    setSecondsLeft(seconds);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function send(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await requestOtp(phone);
      // Until an SMS provider is connected the API can return the code; it is
      // then filled in automatically.
      setCode("");
      setAutoFill("");
      setStep("code");
      countdown(30);
      if (data.devCode) setTimeout(() => fillCode(data.devCode), 450);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await verifyOtp(phone, code, name);
      if (data.referral && !data.referral.applied) {
        // Say why the friend's code did not apply before moving on.
        setReferralNote(data.referral.message);
        setTimeout(() => router.replace(next), 2500);
        return;
      }
      router.replace(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="panel auth-card">
        <div className="auth-head">
          <img src={brand.logo} alt="The Farmers Basket" className="auth-logo" width="140" height="130" />
          <h1>{step === "phone" ? "Welcome to The Farmers Basket" : "Enter your code"}</h1>
          <p>
            {step === "phone"
              ? "Sign in or create an account with your mobile number. No password to remember."
              : `We sent a 6-digit code to +91 ${phone}.`}
          </p>
        </div>

        {error ? <p className="notice error">{error}</p> : null}
        {referralNote ? <p className="notice warn">Signed in. Referral code not applied: {referralNote}</p> : null}
        {referral && !referralNote ? (
          <p className="notice save">You were invited by a friend — code {referral} applies when you sign up.</p>
        ) : null}

        {step === "phone" ? (
          <form onSubmit={send}>
            <div className="field">
              <label htmlFor="phone">Mobile number</label>
              <div className="phone-input">
                <span>+91</span>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit number"
                  autoFocus
                  required
                />
              </div>
            </div>

            <button className="btn primary block lg" disabled={phone.length !== 10 || busy}>
              {busy ? "Sending…" : "Continue"}
            </button>
            <p className="auth-fine">
              By continuing you agree to receive a one-time code by SMS on this number.
            </p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <button type="button" className="link-btn auth-change" onClick={() => setStep("phone")}>
              ← Change number
            </button>

            <div className="field">
              <label htmlFor="code" className="otp-label">
                One-time code
                {autoFill ? (
                  <span className={`otp-auto ${autoFill}`} role="status">
                    {autoFill === "filling" ? (
                      <>
                        <span className="otp-auto-spin" aria-hidden="true" /> Fetching code…
                      </>
                    ) : (
                      <>✓ Auto-filled</>
                    )}
                  </span>
                ) : null}
              </label>
              <input
                id="code"
                type="tel"
                value={code}
                onChange={(e) => {
                  stopFill();
                  setAutoFill("");
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                placeholder="······"
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                className={`otp-input${autoFill ? ` otp-${autoFill}` : ""}`}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Only needed for a new account"
              />
            </div>

            <button className="btn primary block lg" disabled={code.length !== 6 || busy || autoFill === "filling"}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>

            <button
              type="button"
              className="link-btn auth-resend"
              onClick={secondsLeft > 0 ? undefined : send}
              disabled={secondsLeft > 0}
            >
              {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
            </button>
          </form>
        )}

        {/* A developer convenience, never shown to customers. */}
        {process.env.NODE_ENV !== "production" ? (
          <p className="auth-dev">Dev only — seeded test account: 9876543210</p>
        ) : null}
      </div>
    </div>
  );
}
