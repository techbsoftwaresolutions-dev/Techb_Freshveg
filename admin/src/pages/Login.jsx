import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Banner, Field } from "../components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(phone.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="mark">FB</div>
        <h1>The Farmers Basket Admin</h1>
        <p className="muted" style={{ margin: "5px 0 20px", fontSize: 13 }}>
          Sign in with your staff account.
        </p>

        <Banner tone="error">{error}</Banner>

        <Field label="Mobile number">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="username"
            maxLength={10}
            placeholder="10-digit number"
            value={phone}
            // Staff accounts are keyed by a 10-digit number, so anything else
            // is rejected at the keystroke rather than by the server.
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            required
          />
        </Field>

        <Field label="Password">
          {/* The eye lets staff check what the browser auto-filled — a saved
              password for a different account is otherwise invisible. */}
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </Field>

        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function IconEye() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg {...iconProps}>
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
