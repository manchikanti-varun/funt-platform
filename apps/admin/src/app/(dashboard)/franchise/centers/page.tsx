"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageHeader } from "@/components/ui";

interface FranchiseCenter {
  id: string;
  franchiseCode: string;
  centerName: string;
  city: string;
  ownerName: string;
  ownerMobile: string;
  status: string;
  commissionPercent: number;
  totalStudents: number;
  totalRevenuePaise: number;
  pendingPayoutPaise: number;
  onboardedAt: string;
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function FranchiseCentersPage() {
  const [centers, setCenters] = useState<FranchiseCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function loadCenters() {
    setLoading(true);
    api<{ centers: FranchiseCenter[] }>("/api/franchise/admin/centers")
      .then((r) => { if (r.success && r.data?.centers) setCenters(r.data.centers); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCenters(); }, []);

  async function handleDelete(franchiseId: string) {
    setError("");
    setDeletingId(franchiseId);
    try {
      const res = await api<Record<string, unknown>>(`/api/franchise/admin/centers/${franchiseId}`, {
        method: "DELETE",
      });
      if (res.success) {
        setCenters((prev) => prev.map((c) => c.id === franchiseId ? { ...c, status: "CLOSED" } : c));
        setConfirmDeleteId(null);
      } else {
        throw new Error(res.message ?? "Failed to delete franchise");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete franchise");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Franchise Centers"
        subtitle="Manage all franchise partners and their performance."
        actions={
          <Link
            href="/franchise/centers/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
          >
            + Onboard Franchise
          </Link>
        }
      />

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <DataPanel className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : centers.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="font-medium">No franchise centers</p>
            <p className="mt-1 text-sm">Onboard your first franchise partner to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Code</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Center</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">City</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Owner</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Commission</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Students</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Revenue</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {centers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-mono font-medium text-indigo-700">{c.franchiseCode}</td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{c.centerName}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{c.city}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {c.ownerName}
                      <span className="ml-1 text-xs text-slate-400">{c.ownerMobile}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{c.commissionPercent}%</td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{c.totalStudents}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatINR(c.totalRevenuePaise)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" :
                        c.status === "SUSPENDED" ? "bg-amber-100 text-amber-800" :
                        "bg-slate-200 text-slate-600"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {c.status !== "CLOSED" && (
                        <>
                          {confirmDeleteId === c.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleDelete(c.id)}
                                disabled={deletingId === c.id}
                                className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                              >
                                {deletingId === c.id ? "..." : "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(c.id)}
                              className="rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                      {c.status === "CLOSED" && (
                        <span className="text-xs text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </AppPageShell>
  );
}
