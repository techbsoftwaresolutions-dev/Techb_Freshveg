"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";

const REF_KEY = "commerce.web.ref";

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
  // Where to go after signing in. Checkout, orders and the like return the
  // customer to what they were doing; signing in from the Account tab lands on
  // the home page. Only on-site paths are accepted.
  const wanted = params.get("next") || "/";
  const next = !wanted.startsWith("/") || wanted.startsWith("//") || wanted === "/account" ? "/" : wanted;
  const { requestOtp, verifyOtp, signedIn } = useAuth();

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef(null);

  // A friend's code: from an invite link (?ref=CODE, remembered in case the
  // page is reloaded) or typed here. It is only used if this turns out to be
  // a brand-new account.
  const [refCode, setRefCode] = useState("");
  const [refOpen, setRefOpen] = useState(false);
  const [refInfo, setRefInfo] = useState(null);

  useEffect(() => {
    let value = (params.get("ref") || "").trim().toUpperCase();
    try {
      if (value) localStorage.setItem(REF_KEY, value);
      else value = localStorage.getItem(REF_KEY) || "";
    } catch {}
    if (value) {
      setRefCode(value);
      setRefOpen(true);
    }
  }, [params]);

  useEffect(() => {
    const value = refCode.trim();
    if (value.length < 4) {
      setRefInfo(null);
      return undefined;
    }
    const timer2 = setTimeout(() => {
      api
        .get(`/referrals/validate/${encodeURIComponent(value)}`)
        .then((data) => setRefInfo(data))
        .catch(() => setRefInfo(null));
    }, 350);
    return () => clearTimeout(timer2);
  }, [refCode]);

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
      // Outside production the API returns the code, so the site is usable
      // before an SMS provider is connected.
      setDevCode(data.devCode || null);
      // dev: the fixed code rolls in by itself, no copy and paste
      setCode("");
      setRolling(Boolean(data.devCode));
      setStep("code");
      countdown(30);
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
      await verifyOtp(phone, code, undefined, refCode.trim() || undefined);
      try {
        localStorage.removeItem(REF_KEY);
      } catch {}
      router.replace(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Phone only: the logo and welcome sit on the green top, the form on a white sheet below. */}
      <div className="auth-hero">
        <Link href="/" className="auth-back" aria-label="Back to the shop">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <span className="auth-hero-logo"><img src="/logo-mark.png" alt="Hosur Basket" width="92" height="76" /></span>
        <h2>{step === "phone" ? "Login or sign up" : "Verify your number"}</h2>
        <p>{step === "phone" ? "Fresh groceries, delivered fast." : `Code sent to +91 ${phone}`}</p>
      </div>
      <div className="panel auth-card">
        <div className="auth-head">
          <img src="/logo-mark.png" alt="Hosur Basket" className="auth-logo" width="92" height="76" />
          <h1>{step === "phone" ? "Welcome to Hosur Basket" : "Enter your code"}</h1>
          {step === "phone" ? null : <p>{`We sent a 6-digit code to +91 ${phone}.`}</p>}
        </div>

        {error ? <p className="notice error">{error}</p> : null}

        {step === "phone" ? (
          <form onSubmit={send}>
            <div className="field">
              <label htmlFor="phone">Mobile number<b className="req"> *</b></label>
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

            <div className="ref-field">
              {refOpen ? (
                <>
                  <label htmlFor="refcode">Referral code <span>(optional)</span></label>
                  <input
                    id="refcode"
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                    placeholder="Friend's code"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {refInfo?.valid ? (
                    <p className="ref-ok">
                      Invited by <strong>{refInfo.referrerName}</strong> — you get {rupees(refInfo.friendReward)} after your first delivered order
                      {refInfo.minFirstOrderValue ? ` of ${rupees(refInfo.minFirstOrderValue)} or more` : ""}.
                    </p>
                  ) : refInfo && refCode.trim().length >= 4 ? (
                    <p className="ref-bad">This code isn&apos;t valid. You can still continue without it.</p>
                  ) : null}
                </>
              ) : (
                <button type="button" className="link-btn" onClick={() => setRefOpen(true)}>
                  Have a referral code?
                </button>
              )}
            </div>

            <button className="btn primary block lg" disabled={phone.length !== 10 || busy}>
              {busy ? "Sending…" : "Continue"}
            </button>
            <p className="auth-terms">
              By continuing you agree to our <Link href="/terms">Terms &amp; Conditions</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <button type="button" className="link-btn auth-change" onClick={() => setStep("phone")}>
              ← Change number
            </button>

            <div className="field">
              <label htmlFor="code">One-time code<b className="req"> *</b></label>
              {rolling ? (
                <OtpRoll
                  code={devCode}
                  onDone={() => {
                    setCode(devCode);
                    setRolling(false);
                  }}
                />
              ) : (
              <input
                id="code"
                type="tel"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="······"
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                className="otp-input"
                required
              />
              )}
            </div>

            <button className="btn primary block lg" disabled={code.length !== 6 || busy || rolling}>
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
      </div>
    </div>
  );
}

// Dev-only flourish: instead of the code just appearing, each digit rolls
// through 10-15 random numbers, one column after another, and settles on the
// real (fixed) code before the field becomes editable.
function OtpRoll({ code, onDone }) {
  const [go, setGo] = useState(false);
  const strips = useRef(
    code.split("").map((digit) => {
      const count = 10 + Math.floor(Math.random() * 6); // 10-15 numbers scroll past
      const numbers = Array.from({ length: count - 1 }, () => Math.floor(Math.random() * 10));
      return [...numbers, Number(digit)];
    })
  ).current;

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return undefined;
    }
    const start = setTimeout(() => setGo(true), 40);
    const done = setTimeout(onDone, 900 + (strips.length - 1) * 220 + 250);
    return () => {
      clearTimeout(start);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="otp-roll" role="img" aria-label="Filling in your code">
      {strips.map((numbers, i) => (
        <span className="otp-roll-col" key={i}>
          <span
            className="otp-roll-strip"
            style={{
              transform: go ? `translateY(-${(numbers.length - 1) * 1.3}em)` : "translateY(0)",
              transitionDuration: `${900 + i * 220}ms`,
            }}
          >
            {numbers.map((n, j) => (
              <span key={j}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}
