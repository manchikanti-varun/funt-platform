"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, PageSection } from "@/components/ui";

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "Others"] as const;

interface UserMe {
  name: string;
  email?: string;
  mobile: string;
  username?: string;
  age?: number;
  address?: string;
  schoolName?: string;
  city?: string;
  grade?: string;
  gradeOther?: string;
}

export default function AccountPage() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [form, setForm] = useState<Partial<UserMe>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<UserMe>("/api/users/me").then((r) => {
      if (r.success && r.data) {
        setUser(r.data);
        setForm(r.data);
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const ageNum = form.age != null ? Number(form.age) : undefined;
    if (ageNum !== undefined && (Number.isNaN(ageNum) || ageNum < 7)) {
      setMsg("Age must be at least 7.");
      setSaving(false);
      return;
    }
    const grade = form.grade ?? "";
    const gradeOther = grade === "Others" ? (form.gradeOther ?? "").trim() : "";
    if (grade === "Others" && !gradeOther) {
      setMsg("Please enter your grade, year, or program under “Others”.");
      setSaving(false);
      return;
    }
    const res = await api("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        city: form.city,
        schoolName: form.schoolName,
        age: ageNum,
        grade: grade || undefined,
        gradeOther: grade === "Others" ? gradeOther : form.gradeOther ?? "",
      }),
    });
    setSaving(false);
    if (res.success) setMsg("Saved.");
    else setMsg(res.message ?? "Could not save");
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
      </div>
    );
  }

  const gradeVal = form.grade ?? user.grade ?? "";

  return (
    <AppPageShell className="max-w-4xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-black">
        <span aria-hidden>←</span>
        Back
      </Link>
      <div className="page-hero mt-3 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d6f14]">Account</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-black">Profile details</h1>
        <p className="mt-2 text-sm text-black/70">Manage your personal and academic details from one place.</p>
      </div>

      <form onSubmit={handleSave} className="mt-8 space-y-6">
        <PageSection className="border-[#dcc894] bg-gradient-to-br from-white via-[#fffdf7] to-[#fff6df]">
          <p className="text-xs font-black uppercase tracking-wider text-[#8d6f14]">Account identity</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-black">Username</label>
              <input className="input bg-black/[0.03] font-mono" value={user.username ?? "—"} readOnly disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-black">Email</label>
              <input className="input bg-black/[0.03]" value={user.email ?? ""} readOnly disabled />
            </div>
          </div>
        </PageSection>

        <PageSection className="border-[#dcc894] bg-gradient-to-br from-white via-[#fffdf7] to-[#fff6df]">
          <p className="text-xs font-black uppercase tracking-wider text-[#8d6f14]">Personal details</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-black">Name</label>
              <input className="input" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-black">Mobile</label>
              <input className="input bg-black/[0.03]" value={user.mobile ?? ""} readOnly disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-black">Age (minimum 7)</label>
              <input
                type="number"
                min={7}
                max={120}
                className="input"
                value={form.age ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, age: e.target.value === "" ? undefined : Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-black">City</label>
              <input className="input" value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-bold text-black">Address</label>
              <textarea className="input resize-y" rows={3} value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
        </PageSection>

        <PageSection className="border-[#dcc894] bg-gradient-to-br from-white via-[#fffdf7] to-[#fff6df]">
          <p className="text-xs font-black uppercase tracking-wider text-[#8d6f14]">Academic details</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-black">School / college name</label>
              <input className="input" value={form.schoolName ?? ""} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-black">Class / grade</label>
              <select
                className="input"
                value={GRADES.includes(gradeVal as (typeof GRADES)[number]) ? gradeVal : gradeVal ? "Others" : ""}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value, gradeOther: e.target.value === "Others" ? f.gradeOther : "" }))}
              >
                <option value="">Select</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g === "Others" ? "Others (type year / degree below)" : `Class ${g}`}
                  </option>
                ))}
              </select>
              {(form.grade === "Others" || (!GRADES.includes(gradeVal as (typeof GRADES)[number]) && gradeVal)) && (
                <input
                  className="input mt-2"
                  placeholder="e.g. 2nd year B.Tech, diploma, working professional…"
                  value={form.gradeOther ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, gradeOther: e.target.value, grade: "Others" }))}
                />
              )}
            </div>
          </div>
        </PageSection>

        <div className="rounded-2xl border border-[#d7c188] bg-gradient-to-r from-[#fff7dd] via-[#fff2cc] to-[#fff7dd] p-4">
          {msg && <p className="mb-3 text-sm font-semibold text-black">{msg}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full py-3 font-bold">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </AppPageShell>
  );
}
