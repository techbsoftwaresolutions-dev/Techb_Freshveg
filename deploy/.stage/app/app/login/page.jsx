"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/Providers";
import logo from "@/assets/logo-farmers-basket.png";

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
          <img src={logo.src} alt="The Farmers Basket" className="auth-logo" width="140" height="130" />
          <h1>{step === "phone" ? "Welcome to The Farmers Basket" : "Enter your code"}</h1>
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

            <button className="btn primary block lg" disabled={code.length !== 6 || busy}>
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
