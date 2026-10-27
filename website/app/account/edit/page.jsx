"use client";

import Link from "next/link";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";

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
  const [photo, setPhoto] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef(null);

  // Changing the mobile number: type the new one, get a code on it, enter it.
  const [newPhone, setNewPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState("idle"); // idle | code
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState({ tone: "", text: "" });

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || "", email: user.email || "" });
      setPhoto(user.avatar || "");
    }
  }, [user]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  // Squares the picture and shrinks it to 400px before sending, so a phone
  // photo of several MB goes up as a few dozen KB.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const side = Math.min(image.width, image.height);
        const size = Math.min(400, side);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size
        );
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read that image"))), "image/jpeg", 0.85);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("That file is not an image"));
      };
      image.src = url;
    });
  }

  async function changePhoto(file) {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      const blob = await shrink(file);
      const { url } = await api.upload("/uploads/avatar", blob);
      await api.patch("/auth/me", { avatar: url });
      setPhoto(url);
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setError("");
    try {
      await api.patch("/auth/me", { avatar: "" });
      setPhoto("");
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

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
        <div className="page-loading"><MorphingSquare message="Loading…" /></div>
      </div>
    );
  }

  return (
    <div className="wrap wrap-narrow">
      <header className="page-title">
        <Link href="/account" className="section-link">
          ← Back to account
        </Link>
        <h1>Edit profile</h1>
      </header>

      <section className="panel edit-profile-card">
        <div className="edit-profile-head">
          <div className="edit-profile-photo-wrap">
            <button
              type="button"
              className="edit-profile-photo"
              onClick={() => fileInput.current?.click()}
              disabled={photoBusy}
              aria-label="Change profile photo"
            >
              <span className="photo-face">
                {photo ? <img src={photo} alt="" /> : (form.name || user.name || "?").trim().charAt(0)}
              </span>
              <span className="photo-cam" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
            </button>
            {photo ? (
              <button
                type="button"
                className="photo-remove-icon"
                onClick={removePhoto}
                disabled={photoBusy}
                aria-label="Remove photo"
                title="Remove photo"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
                </svg>
              </button>
            ) : null}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => changePhoto(e.target.files?.[0])}
          />
          <div className="edit-profile-who">
            <strong>{form.name || user.name}</strong>
            <span>+91 {user.phone}</span>
          </div>
        </div>
        <form onSubmit={save}>
          {error ? <p className="notice error">{error}</p> : null}
          {saved ? <p className="notice save">Saved.</p> : null}

          <div className="field">
            <label htmlFor="name">Full name</label>
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
