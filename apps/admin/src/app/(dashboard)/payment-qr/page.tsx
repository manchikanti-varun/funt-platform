"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ROLE } from "@funt-platform/constants";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSearchParams } from "next/navigation";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { useAppDialog } from "@/components/ui";
import type { PaymentUpiConfigApiResponse } from "@/components/admin/PlatformUpiCheckoutSummary";

interface GenerateResponse {
  id: string;
  paymentLink: string;
  prefillAmount: boolean;
  amountRupees: number | null;
  upiId: string;
  receiverName: string;
  createdAt: string;
}

interface QrHistoryRow {
  id: string;
  adminName: string;
  adminUsername: string;
  upiId: string;
  receiverName: string;
  prefillAmount: boolean;
  amountRupees: number | null;
  paymentLink: string;
  createdAt: string;
}

interface QrHistoryPayload {
  rows: QrHistoryRow[];
  total: number;
  page: number;
  limit: number;
}
interface PaymentUpiChangeRequestRow {
  id: string;
  proposedUpiId: string;
  proposedReceiverName: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByName: string;
  requestedByUsername: string;
  rejectReason?: string;
  createdAt: string;
}

const QUICK_AMOUNTS = [100, 200, 500, 600];

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function PaymentQrPage() {
  const dialog = useAppDialog();
  const searchParams = useSearchParams();
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);
  const [upiId, setUpiId] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [amount, setAmount] = useState("600");
  const [prefillAmount, setPrefillAmount] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [history, setHistory] = useState<QrHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cfg, setCfg] = useState<PaymentUpiConfigApiResponse | null>(null);
  const [requests, setRequests] = useState<PaymentUpiChangeRequestRow[]>([]);
  const [requestReason, setRequestReason] = useState("");
  const [activeSection, setActiveSection] = useState<"GENERATE" | "UPI" | "HISTORY">("GENERATE");

  useEffect(() => {
    const section = String(searchParams.get("section") ?? "").toUpperCase();
    if (section === "HISTORY") setActiveSection("HISTORY");
    else if (section === "UPI") setActiveSection("UPI");
    else setActiveSection("GENERATE");
  }, [searchParams]);

  const canGenerate = useMemo(() => !!upiId.trim() && !!receiverName.trim() && (!prefillAmount || Number(amount) > 0), [
    upiId,
    receiverName,
    prefillAmount,
    amount,
  ]);

  async function refreshHistory(): Promise<void> {
    if (!isSuperAdmin) return;
    setHistoryLoading(true);
    const r = await api<QrHistoryPayload>("/api/admin/qr-history?page=1&limit=25");
    setHistoryLoading(false);
    if (r.success && r.data?.rows) {
      setHistory(r.data.rows);
    }
  }
  async function loadConfig(): Promise<void> {
    const r = await api<PaymentUpiConfigApiResponse>("/api/admin/payment-upi/config");
    if (r.success && r.data) {
      setCfg(r.data);
      if (r.data.configured) {
        setUpiId(r.data.upiId);
        setReceiverName(r.data.receiverName);
      } else {
        setUpiId("");
        setReceiverName("");
      }
    }
  }
  async function loadRequests(): Promise<void> {
    if (!isSuperAdmin) return;
    const r = await api<PaymentUpiChangeRequestRow[]>("/api/admin/payment-upi/change-requests");
    if (r.success && Array.isArray(r.data)) setRequests(r.data);
  }

  useEffect(() => {
    void loadConfig();
    if (isSuperAdmin) {
      void refreshHistory();
      void loadRequests();
    }
  }, [isSuperAdmin]);

  async function generate(): Promise<void> {
    setMessage(null);
    setError(null);
    if (!canGenerate) {
      setError("Please fill required fields correctly.");
      return;
    }
    setLoading(true);
    const res = await api<GenerateResponse>("/api/admin/generate-qr", {
      method: "POST",
      body: JSON.stringify({
        upiId: upiId.trim(),
        receiverName: receiverName.trim(),
        prefillAmount,
        amount: prefillAmount ? Number(amount) : undefined,
      }),
    });
    setLoading(false);
    if (!res.success) {
      setError(res.message ?? "Failed to generate QR");
      return;
    }
    if (!res.data?.paymentLink) {
      setError("Server did not return a payment link. Please report this — the backend response is missing the paymentLink field.");
      return;
    }
    const link = res.data.paymentLink;
    let url: string;
    try {
      url = await QRCode.toDataURL(link, {
        width: 320,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    } catch (err) {
      setError(`Could not render QR image: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    setPaymentLink(link);
    setQrDataUrl(url);
    setMessage("Payment QR generated.");
    await refreshHistory();
  }
  async function submitUpiChangeRequest(): Promise<void> {
    setMessage(null);
    setError(null);
    const res = await api("/api/admin/payment-upi/change-requests", {
      method: "POST",
      body: JSON.stringify({
        proposedUpiId: upiId.trim(),
        proposedReceiverName: receiverName.trim(),
        reason: requestReason.trim(),
      }),
    });
    if (res.success) {
      setMessage("UPI change request submitted to Super Admin.");
      setRequestReason("");
    } else setError(res.message ?? "Failed to submit request");
  }
  async function updateUpiConfigDirectly(): Promise<void> {
    setMessage(null);
    setError(null);
    const res = await api("/api/admin/payment-upi/config", {
      method: "PATCH",
      body: JSON.stringify({
        upiId: upiId.trim(),
        receiverName: receiverName.trim(),
        reason: "Super Admin direct update",
      }),
    });
    if (res.success) {
      setMessage("Payment UPI config updated.");
      await loadConfig();
      await loadRequests();
    } else setError(res.message ?? "Failed to update UPI config");
  }
  async function approveRequest(id: string): Promise<void> {
    const res = await api(`/api/admin/payment-upi/change-requests/${encodeURIComponent(id)}/approve`, { method: "POST" });
    if (res.success) {
      setMessage("Request approved and UPI updated.");
      await loadConfig();
      await loadRequests();
    } else setError(res.message ?? "Could not approve request");
  }
  async function rejectRequest(id: string): Promise<void> {
    const reason = await dialog.prompt({
      title: "Reject UPI change request",
      label: "Reason for rejection",
      optional: true,
      confirmLabel: "Reject",
    });
    if (reason === null) return;
    const res = await api(`/api/admin/payment-upi/change-requests/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
    if (res.success) {
      setMessage("Request rejected.");
      await loadRequests();
    } else setError(res.message ?? "Could not reject request");
  }

  async function copyLink(): Promise<void> {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    setMessage("Payment link copied.");
  }

  function downloadPng(): void {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `payment-qr-${Date.now()}.png`;
    a.click();
  }

  function downloadOfflineSharePackage(): void {
    if (!qrDataUrl || !paymentLink) return;
    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Payment QR Share</title></head>
<body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a">
<h2 style="margin:0 0 8px 0">Payment QR</h2>
<p style="margin:0 0 16px 0">Scan using any UPI app (GPay, PhonePe, Paytm).</p>
<img src="${qrDataUrl}" alt="QR" style="width:280px;height:280px;border:1px solid #e2e8f0;border-radius:12px;padding:8px"/>
<p style="margin-top:16px;font-size:12px;word-break:break-all"><strong>UPI Link:</strong> ${paymentLink}</p>
<ol style="font-size:13px;line-height:1.5">
<li>Scan QR and confirm receiver details.</li>
<li>If amount is not prefilled, enter the exact instructed amount.</li>
<li>Complete payment and keep transaction reference.</li>
</ol>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-qr-share-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full space-y-6">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <PageHeader
        title="Generate Payment QR"
        subtitle="Create fixed-course-fee QR (amount prefilled) or open-amount QR (payer enters amount manually)."
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSection("GENERATE")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeSection === "GENERATE" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          Generate QR
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("UPI")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeSection === "UPI" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          UPI config & requests
        </button>
        {isSuperAdmin ? (
          <button
            type="button"
            onClick={() => setActiveSection("HISTORY")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeSection === "HISTORY" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            QR history
          </button>
        ) : null}
      </div>

      <div className={`grid gap-6 ${activeSection === "GENERATE" ? "lg:grid-cols-[1fr_360px]" : "lg:grid-cols-1"}`}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            {activeSection === "GENERATE" ? "Configuration" : "UPI configuration"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">UPI ID (pa)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="school@okaxis"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                disabled={!isSuperAdmin && cfg?.configured === true}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Receiver Name (pn)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="FUNT Learn"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                disabled={!isSuperAdmin && cfg?.configured === true}
              />
            </label>
          </div>
          {!isSuperAdmin && cfg?.configured ? (
            <p className="mt-2 text-xs text-slate-500">
              UPI ID and receiver are read-only for your role. If something is wrong, use <strong>Request UPI change</strong> below.
            </p>
          ) : !isSuperAdmin && cfg && !cfg.configured ? (
            <p className="mt-2 text-xs text-slate-600">
              No platform UPI is active yet. Enter the <strong>UPI ID and payee name you need</strong>, then submit a request below with a short reason (at least 8 characters).
            </p>
          ) : null}
          {isSuperAdmin ? (
            <button
              type="button"
              className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => void updateUpiConfigDirectly()}
            >
              Save UPI config (Super Admin)
            </button>
          ) : null}
          {cfg?.configured ? (
            <p className="mt-2 text-xs text-slate-500">
              Active receiving UPI: <span className="font-mono">{cfg.upiId}</span> ({cfg.receiverName})
            </p>
          ) : cfg ? (
            <p className="mt-2 text-xs text-amber-800">
              No platform receiving UPI is saved yet. Super Admin can save one above; others can submit a change request in the UPI tab.
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <input
              id="prefill-amount"
              type="checkbox"
              checked={prefillAmount}
              onChange={(e) => setPrefillAmount(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600"
            />
            <label htmlFor="prefill-amount" className="text-sm font-medium text-slate-700">
              Prefill Amount
            </label>
          </div>

          {activeSection === "GENERATE" ? (
          <div className="mt-4">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Course fee / Amount (am)</span>
              <input
                className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!prefillAmount}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setAmount(String(v))}
                  disabled={!prefillAmount}
                >
                  ₹{v}
                </button>
              ))}
            </div>
          </div>
          ) : null}

          {activeSection === "GENERATE" ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading || !canGenerate}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate QR"}
            </button>
            <button
              type="button"
              onClick={downloadPng}
              disabled={!qrDataUrl}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Download QR (PNG)
            </button>
            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={!paymentLink}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Copy payment link
            </button>
            <button
              type="button"
              onClick={downloadOfflineSharePackage}
              disabled={!paymentLink || !qrDataUrl}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Download offline share package
            </button>
          </div>
          ) : null}

          {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
          {activeSection === "UPI" && !isSuperAdmin ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Request UPI change (if current UPI is down)</p>
              <textarea
                className="mt-2 min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Mention outage reason and urgency..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
              />
              <button
                type="button"
                className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                onClick={() => void submitUpiChangeRequest()}
              >
                Submit request to Super Admin
              </button>
            </div>
          ) : null}
        </div>

        {activeSection === "GENERATE" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">QR Preview</p>
          <div className="mt-4 flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Payment QR" className="h-72 w-72 rounded-lg bg-white p-2" />
            ) : (
              <p className="text-sm text-slate-500">Generate a QR to preview</p>
            )}
          </div>
        </div>
        ) : null}
      </div>

      {isSuperAdmin && activeSection === "UPI" ? (
        <>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">UPI Change Requests</h2>
            <button
              type="button"
              onClick={() => void loadRequests()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-2 font-semibold text-slate-700">Requester</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Proposed UPI</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Receiver</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Reason</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{r.requestedByName}</div>
                      <div className="text-xs text-slate-500">@{r.requestedByUsername}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.proposedUpiId}</td>
                    <td className="px-3 py-2">{r.proposedReceiverName}</td>
                    <td className="px-3 py-2 max-w-[20rem] text-xs text-slate-700">{r.reason}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">
                      {r.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <button type="button" className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => void approveRequest(r.id)}>Approve</button>
                          <button type="button" className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700" onClick={() => void rejectRequest(r.id)}>Reject</button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">{r.rejectReason || "Processed"}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No requests yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : null}
      {isSuperAdmin && activeSection === "HISTORY" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">QR Generation History</h2>
            <button
              type="button"
              onClick={() => void refreshHistory()}
              disabled={historyLoading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {historyLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-2 font-semibold text-slate-700">Admin</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">UPI ID</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Receiver</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Prefill</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Amount</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-slate-700"><div className="font-medium">{row.adminName}</div><div className="text-xs text-slate-500">@{row.adminUsername}</div></td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.upiId}</td>
                    <td className="px-3 py-2 text-slate-700">{row.receiverName}</td>
                    <td className="px-3 py-2 text-slate-700">{row.prefillAmount ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.amountRupees != null ? `₹${row.amountRupees.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{fmtDate(row.createdAt)}</td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No records yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
