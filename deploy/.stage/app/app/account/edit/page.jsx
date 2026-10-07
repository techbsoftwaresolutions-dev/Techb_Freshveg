"use client";

import Link from "next/link";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (user) setForm({ name: user.name || "", email: user.email || "" });
  }, [user]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

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

      <section className="panel">
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
            <label>Mobile number</label>
            <input type="tel" value={`+91 ${user.phone}`} disabled />
            <span className="help">Your mobile number is how you sign in and can't be changed here.</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
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
