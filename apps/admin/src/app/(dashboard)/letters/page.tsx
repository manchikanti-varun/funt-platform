"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { ROLE } from "@funt-platform/constants";
import { Plus, Settings, Search, FileText, Filter, X } from "lucide-react";

import { LetterStatsBar } from "./components/LetterStatsBar";
import { LetterTable } from "./components/LetterTable";
import { LetterCreateForm } from "./components/LetterCreateForm";
import { RevokeModal } from "./components/RevokeModal";
import { ExtendModal } from "./components/ExtendModal";
import { ExperienceModal } from "./components/ExperienceModal";
import { DeleteModal } from "./components/DeleteModal";
import { LetterPreviewPanel } from "./components/LetterPreviewPanel";
import type { LetterRow } from "./types";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Needs Approval" },
  { value: "PENDING_ACCEPTANCE", label: "Awaiting Intern" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "ACTIVE", label: "Active" },
  { value: "REJECTED_BY_INTERN", label: "Declined" },
  { value: "EXPIRED", label: "Expired" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "REVOKED", label: "Revoked" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "OFFER_LETTER", label: "Offer Letter" },
  { value: "EXPERIENCE_LETTER", label: "Experience Letter" },
];

export default function LettersPage() {
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Modal state
  const [revokeId, setRevokeId] = useState("");
  const [extendId, setExtendId] = useState("");
  const [expId, setExpId] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LetterRow | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filterStatus) qs.set("status", filterStatus);
    if (filterType) qs.set("type", filterType);
    if (search.trim()) qs.set("search", search.trim());
    const r = await api<LetterRow[]>(`/api/letters?${qs}`);
    if (r.success && Array.isArray(r.data)) setLetters(r.data);
    setLoading(false);
  }, [filterStatus, filterType, search]);

  useEffect(() => { load(); }, [load]);

  // Stats derived from all loaded letters
  const stats = {
    total: letters.length,
    draft: letters.filter((l) => l.status === "DRAFT").length,
    pendingApproval: letters.filter((l) => l.status === "PENDING_APPROVAL").length,
    pendingAcceptance: letters.filter((l) => l.status === "PENDING_ACCEPTANCE").length,
    accepted: letters.filter((l) => l.status === "ACCEPTED" || l.status === "ACTIVE").length,
    experience: letters.filter((l) => l.type === "EXPERIENCE_LETTER").length,
  };

  async function handleAction(id: string, action: string, body?: Record<string, unknown>) {
    const method = ["accept", "withdraw", "revoke", "intern-reject"].includes(action) ? "PATCH" : "POST";
    const r = await api(`/api/letters/${id}/${action}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.success) load();
  }

  function handleDownloadPdf(id: string) {
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472"}/api/letters/${id}/pdf`;
    fetch(url, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = `${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(u);
      })
      .catch(() => {});
  }

  const hasActiveFilters = filterStatus || filterType || search;

  return (
    <AppPageShell>
      <RequireRoles roles={[ROLE.SUPER_ADMIN, ROLE.ADMIN]} fallbackHref="/dashboard" />

      {/* Header */}
      <PageHeader
        title="Letters"
        subtitle="Manage offer letters, extensions, and experience letters with public verification."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/letters/settings"
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              <Settings className="h-4 w-4 text-slate-500" />
              Template
            </Link>
            <button
              onClick={() => setShowForm((v) => !v)}
              className={`inline-flex items-center gap-2 text-sm font-semibold transition ${
                showForm
                  ? "btn-secondary"
                  : "btn-primary"
              }`}
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Close" : "New Offer Letter"}
            </button>
          </div>
        }
      />

      {/* Stats */}
      {!loading && letters.length > 0 && <LetterStatsBar stats={stats} />}

      {/* Create Form */}
      {showForm && (
        <LetterCreateForm
          onCreated={load}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="input w-64 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input w-auto text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input w-auto text-sm"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setFilterStatus(""); setFilterType(""); }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {letters.length} letter{letters.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      ) : letters.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={hasActiveFilters ? "No letters match your filters" : "No letters yet"}
          description={
            hasActiveFilters
              ? "Try adjusting or clearing your filters."
              : "Generate your first offer letter to get started."
          }
          action={
            hasActiveFilters ? (
              <button
                onClick={() => { setSearch(""); setFilterStatus(""); setFilterType(""); }}
                className="btn-secondary text-sm"
              >
                Clear Filters
              </button>
            ) : (
              <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" /> New Offer Letter
              </button>
            )
          }
        />
      ) : (
        <LetterTable
          letters={letters}
          onAction={handleAction}
          onDownloadPdf={handleDownloadPdf}
          onRevoke={setRevokeId}
          onExtend={setExtendId}
          onExperience={setExpId}
          onPreview={setPreviewId}
          onDelete={setDeleteTarget}
        />
      )}

      {/* Modals */}
      {revokeId && (
        <RevokeModal
          letterId={revokeId}
          onConfirm={async (reason) => {
            await handleAction(revokeId, "revoke", { reason });
            setRevokeId("");
          }}
          onClose={() => setRevokeId("")}
        />
      )}
      {extendId && (
        <ExtendModal
          letterId={extendId}
          onDone={() => { setExtendId(""); load(); }}
          onClose={() => setExtendId("")}
        />
      )}
      {expId && (
        <ExperienceModal
          letterId={expId}
          onDone={() => { setExpId(""); load(); }}
          onClose={() => setExpId("")}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          letterId={deleteTarget._id || deleteTarget.letterId}
          recipientName={deleteTarget.recipientName}
          onDeleted={() => { setDeleteTarget(null); load(); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {previewId && (
        <LetterPreviewPanel
          letterId={previewId}
          onClose={() => setPreviewId("")}
          onDownloadPdf={handleDownloadPdf}
        />
      )}
    </AppPageShell>
  );
}
