"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/Providers";

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

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef(null);

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
      await verifyOtp(phone, code, name);
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
          <span className="auth-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
              <path d="M22 44C9 42 2 31 4 14c11 1 19 8 20 20 0 4-1 7-2 10Z" fill="#4caf50" />
              <path d="M24 44c1-14 7-26 20-32 2 17-5 29-18 32h-2Z" fill="#1b7a3a" />
            </svg>
          </span>
          <h1>{step === "phone" ? "Welcome to Hosur Basket" : "Enter your code"}</h1>
          <p>
            {step === "phone"
              ? "Sign in or create an account with your mobile number. No password to remember."
              : `We sent a 6-digit code to +91 ${phone}.`}
          </p>
        </div>

        {error ? <p className="notice error">{error}</p> : null}

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

            {devCode ? (
              <p className="notice info">Development mode — your code is {devCode}</p>
            ) : null}

            <div className="field">
              <label htmlFor="code">One-time code</label>
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
