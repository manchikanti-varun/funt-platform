"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageHeader, Button, useAppDialog } from "@/components/ui";

interface KeyRequest {
  id: string;
  franchiseId: string;
  franchiseCode: string;
  centerName: string;
  courseId: string;
  courseTitle: string;
  requestedCount: number;
  paymentProofUrl: string;
  note: string;
  createdAt: string;
}

export default function FranchiseKeyRequestsAdminPage() {
  const dialog = useAppDialog();
  const [requests, setRequests] = useState<KeyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    const res = await api<{ requests: KeyRequest[] }>("/api/franchise/admin/key-requests");
    if (res.success && res.data?.requests) {
      setRequests(res.data.requests);
    }
    setLoading(false);
  }

  useEffect(() => { loadRequests(); }, []);

  async function handleApprove(req: KeyRequest) {
    const countStr = await dialog.prompt({
      title: `Approve Key Request`,
      label: `${req.centerName} requested ${req.requestedCount} keys for "${req.courseTitle}".\n\nHow many keys do you want to allocate?`,
      defaultValue: String(req.requestedCount),
      placeholder: "Number of keys",
    });
    if (!countStr) return;
    const count = parseInt(countStr, 10);
    if (!count || count < 1) return;

    setProcessing(req.id);
    const res = await api(`/api/franchise/admin/key-requests/${req.id}/approve`, {
      method: "POST",
      body: JSON.stringify({ allocatedCount: count }),
    });
    setProcessing(null);

    if (res.success) {
      await dialog.alert({ title: "Approved", message: `${count} keys allocated to ${req.centerName}.` });
      loadRequests();
    } else {
      await dialog.alert({ title: "Error", message: res.message ?? "Failed to approve request" });
    }
  }

  async function handleReject(req: KeyRequest) {
    const reason = await dialog.prompt({
      title: `Reject Key Request`,
      label: `Rejecting request from ${req.centerName} for ${req.requestedCount} keys.\n\nReason (optional):`,
      defaultValue: "",
      placeholder: "Rejection reason",
      optional: true,
    });
    if (reason === null) return; // cancelled

    setProcessing(req.id);
    const res = await api(`/api/franchise/admin/key-requests/${req.id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    setProcessing(null);

    if (res.success) {
      await dialog.alert({ title: "Rejected", message: "Request has been rejected." });
      loadRequests();
    } else {
      await dialog.alert({ title: "Error", message: res.message ?? "Failed to reject request" });
    }
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Franchise Key Requests"
        subtitle="Review and approve license key purchase requests from franchise owners."
      />

      <DataPanel className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="font-medium">No pending key requests</p>
            <p className="mt-1 text-sm">All franchise key requests have been processed.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {requests.map((req) => (
              <div key={req.id} className="p-5 hover:bg-slate-50/50">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: Request details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        {req.franchiseCode}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{req.centerName}</span>
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="font-medium">{req.requestedCount} keys</span> requested for{" "}
                      <span className="font-medium">{req.courseTitle}</span>
                    </div>
                    {req.note && (
                      <p className="text-sm text-slate-500">Note: {req.note}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      {new Date(req.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Middle: Payment proof */}
                  <div className="shrink-0">
                    {req.paymentProofUrl ? (
                      <div className="space-y-2">
                        {/\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(req.paymentProofUrl) ? (
                          <a href={req.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={req.paymentProofUrl}
                              alt="Payment proof"
                              className="h-20 w-auto max-w-[160px] rounded-lg border border-slate-200 object-cover shadow-sm hover:shadow-md transition"
                            />
                          </a>
                        ) : (
                          <a
                            href={req.paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            View Payment Proof
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No proof uploaded</span>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="primary"
                      disabled={processing === req.id}
                      onClick={() => handleApprove(req)}
                    >
                      {processing === req.id ? "…" : "Approve"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={processing === req.id}
                      onClick={() => handleReject(req)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
