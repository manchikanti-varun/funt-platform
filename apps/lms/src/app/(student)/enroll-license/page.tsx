"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel } from "@/components/ui";

export default function EnrollLicensePage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const trimmed = key.trim();
    if (!trimmed) {
      setMsg({ type: "err", text: "Enter the license key your administrator gave you." });
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    try {
      const res = await api<{ batchId?: string; message?: string }>("/api/student/enroll/license", {
        method: "POST",
        body: JSON.stringify({ licenseKey: trimmed }),
        signal: controller.signal,
      });
      if (res.success) {
        setMsg({ type: "ok", text: res.message ?? "You are now enrolled. Opening your courses…" });
        router.refresh();
        router.push("/courses");
      } else {
        setMsg({ type: "err", text: res.message ?? "Could not redeem this key." });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMsg({ type: "err", text: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppPageShell className="max-w-3xl">
      <Link href="/courses" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to courses
      </Link>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <FormPanel className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50/30 to-slate-50 p-7 shadow-xl shadow-indigo-900/10">
          <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-indigo-100 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              Student Access
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-black">Enroll with License Key</h1>
            <p className="mt-2 text-sm text-black/75">
              Enter your one-time `FUNT-...` key to unlock the assigned course.
            </p>
          </div>
          <div className="my-6 h-px bg-gradient-to-r from-indigo-300 via-indigo-200 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-semibold text-black">
              License key
              <div className="mt-2 rounded-2xl border border-indigo-200 bg-white p-1 shadow-inner">
                <input
                  className="input border-0 bg-transparent font-mono text-sm tracking-[0.04em] uppercase text-black/75 shadow-none placeholder:text-black/40 placeholder:normal-case focus:ring-0"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="FUNT-XXXXXXXX"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </label>
            {msg && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                  msg.type === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {msg.text}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base font-bold transition disabled:opacity-60"
            >
              {loading ? "Verifying key..." : "Activate Course Access"}
            </button>
          </form>
        </FormPanel>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-slate-50 px-4 py-4 shadow-md shadow-indigo-900/10">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-700">Key rules</p>
            <ul className="mt-2 space-y-1 text-xs text-black/80">
              <li>One key = one enrollment</li>
              <li>Case-insensitive format</li>
              <li>Cannot be reused</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-xs text-black/75 shadow-sm">
            Paid online? Open <Link href="/courses" className="font-semibold text-indigo-600 underline">Courses</Link> and use payment details inside that course.
          </div>
        </aside>
      </div>
    </AppPageShell>
  );
}
