"use client";

import Link from "next/link";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { IconBack, IconUser } from "@/components/AccountIcons";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, ready, signedIn, refreshUser } = useAuth();

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/account/edit");
  }, [ready, signedIn, router]);

  const [form, setForm] = useState({ name: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Changing the mobile number: type the new one, get a code on it, enter it.
  const [newPhone, setNewPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState("idle"); // idle | code
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState({ tone: "", text: "" });

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || "", email: user.email || "" });
    }
  }, [user]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function sendPhoneCode() {
    setPhoneBusy(true);
    setPhoneMsg({ tone: "", text: "" });
    try {
      await api.post("/auth/me/phone/check", { phone: newPhone });
      const data = await api.post("/auth/otp/request", { phone: newPhone });
      // Outside production the API returns the code so this works before an
      // SMS provider is connected.
      setPhoneCode(data.devCode || "");
      setPhoneStep("code");
    } catch (err) {
      setPhoneMsg({ tone: "error", text: err.message });
    } finally {
      setPhoneBusy(false);
    }
  }

  async function confirmPhone() {
    setPhoneBusy(true);
    setPhoneMsg({ tone: "", text: "" });
    try {
      await api.post("/auth/me/phone/verify", { phone: newPhone, code: phoneCode });
      await refreshUser();
      setNewPhone("");
      setPhoneCode("");
      setPhoneStep("idle");
      setPhoneMsg({ tone: "save", text: "Mobile number updated." });
    } catch (err) {
      setPhoneMsg({ tone: "error", text: err.message });
    } finally {
      setPhoneBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.patch("/auth/me", { name: form.name.trim(), email: form.email.trim() });
      await refreshUser();
      setSaved(true);
      setTimeout(() => router.push("/account"), 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !user) {
    return (
      <div className="wrap">
        <div className="cat-mobile-head acct-head">
          <Link href="/account" aria-label="Back" className="cat-mobile-btn">
            <IconBack width={22} height={22} strokeWidth={2} />
          </Link>
          <h1 className="cat-mobile-title">Edit profile</h1>
        </div>
        <div className="page-loading"><MorphingSquare message="Loading…" /></div>
      </div>
    );
  }

  return (
    <div className="wrap wrap-narrow edit-page">
      {/* Phone: app-style bar instead of the site header and search. */}
      <div className="cat-mobile-head acct-head">
        <Link href="/account" aria-label="Back" className="cat-mobile-btn">
          <IconBack width={22} height={22} strokeWidth={2} />
        </Link>
        <h1 className="cat-mobile-title">Edit profile</h1>
      </div>

      <header className="page-title edit-title-desktop">
        <Link href="/account" className="section-link">
          ← Back to account
        </Link>
        <h1>Edit profile</h1>
      </header>

      <section className="panel edit-profile-card">
        <div className="edit-profile-head">
          {/* No photo upload: the profile shows the first letter of the name. */}
          <div className="edit-profile-photo-wrap">
            <span className="edit-profile-photo" aria-hidden="true">
              <span className="photo-face">
                {(form.name || user.name || "").trim() ? (form.name || user.name).trim().charAt(0).toUpperCase() : <IconUser width={40} height={40} />}
              </span>
            </span>
          </div>
          <div className="edit-profile-who">
            <strong>{form.name || user.name}</strong>
            <span>+91 {user.phone}</span>
          </div>
        </div>
        <form onSubmit={save}>
          {error ? <p className="notice error">{error}</p> : null}
          {saved ? <p className="notice save">Saved.</p> : null}

          <div className="field">
            <label htmlFor="name">Full name<b className="req"> *</b></label>
            <input id="name" type="text" value={form.name} onChange={set("name")} required />
          </div>

          <div className="field">
            <label htmlFor="email">Email (optional)</label>
            <input id="email" type="email" value={form.email} onChange={set("email")} />
          </div>

          <div className="field">
            <label htmlFor="phone">Mobile number</label>
            <div className="phone-input">
              <span>+91</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={phoneStep === "idle" && !newPhone ? user.phone : newPhone}
                onFocus={() => {
                  if (phoneStep === "idle" && !newPhone) setNewPhone(user.phone);
                }}
                onChange={(e) => {
                  setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setPhoneStep("idle");
                  setPhoneMsg({ tone: "", text: "" });
                }}
                disabled={phoneStep === "code"}
              />
            </div>

            {phoneMsg.text ? <p className={`notice ${phoneMsg.tone}`} style={{ marginTop: 8 }}>{phoneMsg.text}</p> : null}

            {phoneStep === "idle" && newPhone.length === 10 && newPhone !== user.phone ? (
              <button type="button" className="btn sm" style={{ marginTop: 8, alignSelf: "flex-start" }} onClick={sendPhoneCode} disabled={phoneBusy}>
                {phoneBusy ? "Sending…" : "Send code to this number"}
              </button>
            ) : null}

            {phoneStep === "code" ? (
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn sm primary" onClick={confirmPhone} disabled={phoneBusy || phoneCode.length !== 6}>
                    {phoneBusy ? "Verifying…" : "Verify & update"}
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setPhoneStep("idle");
                      setPhoneCode("");
                      setNewPhone("");
                      setPhoneMsg({ tone: "", text: "" });
                    }}
                    disabled={phoneBusy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="profile-actions">
            <button className="btn primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <Link href="/account" className="btn">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
