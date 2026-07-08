"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell } from "@/components/ui";

interface ReferralData {
  code: string;
  totalReferrals: number;
  totalCoinsEarned: number;
  totalXpEarned: number;
}

interface ReferralEntry {
  refereeId: string;
  refereeName: string;
  refereeUsername: string;
  coinsEarned: number;
  xpEarned: number;
  redeemedAt: string;
}

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState("");
  const [redeemErr, setRedeemErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api<ReferralData>("/api/referral/my-code"),
      api<ReferralEntry[]>("/api/referral/my-referrals"),
    ]).then(([codeRes, refRes]) => {
      if (codeRes.success && codeRes.data) setData(codeRes.data);
      if (refRes.success && Array.isArray(refRes.data)) setReferrals(refRes.data);
    }).finally(() => setLoading(false));
  }, []);

  function copyCode() {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setRedeemMsg(""); setRedeemErr("");
    if (!redeemCode.trim()) { setRedeemErr("Enter a referral code"); return; }
    setSubmitting(true);
    const res = await api<{ message: string }>("/api/referral/redeem", {
      method: "POST", body: JSON.stringify({ code: redeemCode.trim() }),
    });
    setSubmitting(false);
    if (res.success && res.data) {
      setRedeemMsg(res.data.message ?? "Referral code applied!");
      setRedeemCode("");
    } else {
      setRedeemErr(res.message ?? "Failed to redeem code");
    }
  }

  if (loading) return <AppPageShell><div className="flex justify-center py-20"><div className="spinner" /></div></AppPageShell>;

  return (
    <AppPageShell className="max-w-2xl pb-8">
      <div className="page-hero">
        <p className="label-overline">Rewards</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-black">Referral Program</h1>
        <p className="mt-1 text-sm text-black/60">Share your code with friends. Both of you earn rewards!</p>
      </div>

      {/* My Referral Code */}
      {data && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Your Referral Code</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-mono text-2xl font-black text-indigo-700 tracking-wide">{data.code}</span>
            <button onClick={copyCode}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition">
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Share this code with friends. When they sign up and use it, you both get rewards!</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-slate-800">{data.totalReferrals}</p>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Referrals</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{data.totalCoinsEarned}</p>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Coins Earned</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
              <p className="text-lg font-bold text-indigo-600">{data.totalXpEarned}</p>
              <p className="text-[10px] font-semibold uppercase text-slate-500">XP Earned</p>
            </div>
          </div>
        </div>
      )}

      {/* Redeem a Code */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Have a referral code?</p>
        <p className="mt-0.5 text-xs text-slate-500">Enter it below to earn your welcome bonus of 25 FUNT Coins.</p>
        <form onSubmit={handleRedeem} className="mt-3 flex gap-2">
          <input type="text" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
            placeholder="FUNT-XXXXX-XXXX" className="input flex-1 font-mono uppercase" />
          <button type="submit" disabled={submitting}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            {submitting ? "..." : "Apply"}
          </button>
        </form>
        {redeemMsg && <p className="mt-2 text-sm text-emerald-600 font-medium">{redeemMsg}</p>}
        {redeemErr && <p className="mt-2 text-sm text-red-600 font-medium">{redeemErr}</p>}
      </div>

      {/* Referral History */}
      {referrals.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Your Referrals</p>
          </div>
          <div className="divide-y divide-slate-100">
            {referrals.map((r) => (
              <div key={r.refereeId} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.refereeName}</p>
                  <p className="text-xs text-slate-500">@{r.refereeUsername}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-600">+{r.coinsEarned} coins</p>
                  <p className="text-xs text-slate-400">{new Date(r.redeemedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
