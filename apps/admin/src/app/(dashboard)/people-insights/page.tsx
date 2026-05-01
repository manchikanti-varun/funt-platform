"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ROLE } from "@funt-platform/constants";
import { CheckCheck, Code2, Download, Eye, ListChecks, RefreshCw, X } from "lucide-react";
import { api, apiUrl } from "@/lib/api";
import { AppPageShell, FormPanel, PageSection } from "@/components/ui";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { useAdminUser } from "@/contexts/AdminUserContext";

type PeopleRole = "STUDENT" | "ADMIN" | "TRAINER" | "SUPER_ADMIN";

type PersonRow = {
  id: string;
  funtId: string;
  name: string;
  username: string;
  email: string;
  mobile: string;
  city: string;
  status: string;
  role: PeopleRole;
  joinedAt: string;
  studentXp?: number;
  studentLevel?: number;
  coursesCompletedCount?: number;
  activeEnrollments?: number;
  certificatesIssued?: number;
};

type PeopleResponse = {
  rows: PersonRow[];
  meta: { page: number; limit: number; total: number; pages: number };
};

const ROLE_TABS: Array<{ id: PeopleRole; label: string }> = [
  { id: "STUDENT", label: "Students" },
  { id: "ADMIN", label: "Admin" },
  { id: "TRAINER", label: "Trainer" },
  { id: "SUPER_ADMIN", label: "Super Admin" },
];

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function IconActionButton({
  title,
  ariaLabel,
  onClick,
  href,
  className,
  children,
}: {
  title: string;
  ariaLabel: string;
  onClick?: () => void;
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const base =
    "inline-flex h-10 w-10 items-center justify-center rounded-lg border text-slate-700 shadow-sm transition disabled:opacity-50";
  if (href) {
    return (
      <a href={href} title={title} aria-label={ariaLabel} className={`${base} ${className ?? "border-slate-200 bg-white hover:bg-slate-50"}`}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`${base} ${className ?? "border-slate-200 bg-white hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}

export default function PeopleInsightsPage() {
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);
  const [role, setRole] = useState<PeopleRole>("STUDENT");
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [studentPreview, setStudentPreview] = useState<PersonRow | null>(null);

  const canSeeSuperAdminTab = isSuperAdmin;
  const tabs = useMemo(() => ROLE_TABS.filter((t) => canSeeSuperAdminTab || t.id !== "SUPER_ADMIN"), [canSeeSuperAdminTab]);

  useEffect(() => {
    if (!canSeeSuperAdminTab && role === "SUPER_ADMIN") setRole("STUDENT");
  }, [canSeeSuperAdminTab, role]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      role,
      page: String(page),
      limit: String(limit),
    });
    if (query.trim()) params.set("q", query.trim());
    if (joinedFrom) params.set("joinedFrom", joinedFrom);
    if (joinedTo) params.set("joinedTo", joinedTo);
    const res = await api<PeopleResponse>(`/api/admin/people?${params.toString()}`);
    setLoading(false);
    if (res.success && res.data && Array.isArray(res.data.rows)) {
      setRows(res.data.rows);
      setTotal(Number(res.data.meta?.total ?? res.data.rows.length));
      setPages(Math.max(1, Number(res.data.meta?.pages ?? 1)));
      setSelectedIds([]);
      return;
    }
    setRows([]);
    setTotal(0);
    setPages(1);
    setMessage({ type: "error", text: res.message ?? "Failed to load people data." });
  }

  useEffect(() => {
    void load();
  }, [role, page, limit]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function downloadUrl(path: string): string {
    return apiUrl(path);
  }

  async function bulkDownload() {
    if (selectedIds.length === 0) {
      setMessage({ type: "error", text: "Select at least one row for bulk download." });
      return;
    }
    const res = await fetch(downloadUrl("/api/admin/people/bulk-download"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, userIds: selectedIds, format: "csv" }),
    });
    if (!res.ok) {
      setMessage({ type: "error", text: "Bulk download failed." });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${role.toLowerCase()}-selected.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ type: "success", text: `Downloaded ${selectedIds.length} selected ${role.toLowerCase()} records.` });
  }

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN]} fallbackHref="/dashboard" />
      <PageSection>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">People Insights</h1>
        <p className="mt-1 text-sm text-slate-600">
          View and download people data by role. Students include progress details like XP, level, enrollments, and certificates.
        </p>
      </PageSection>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setRole(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              role === t.id
                ? "bg-teal-600 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FormPanel className="space-y-4">
        <div className="grid gap-2 md:grid-cols-5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, username, email, mobile, FUNT ID"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm md:col-span-2"
          />
          <input
            type="date"
            value={joinedFrom}
            onChange={(e) => setJoinedFrom(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
          />
          <input
            type="date"
            value={joinedTo}
            onChange={(e) => setJoinedTo(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
          />
          <IconActionButton
            title="Apply filters"
            ariaLabel="Apply filters"
            onClick={() => {
              setPage(1);
              void load();
            }}
          >
            <CheckCheck className="h-5 w-5" />
          </IconActionButton>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            {loading ? "Loading…" : `${rows.length} records on page · ${total} total`} · {selectedIds.length} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconActionButton
              title="Download all as CSV"
              ariaLabel="Download all as CSV"
              href={downloadUrl(
                `/api/admin/people?role=${encodeURIComponent(role)}&format=csv&q=${encodeURIComponent(query)}&joinedFrom=${encodeURIComponent(
                  joinedFrom
                )}&joinedTo=${encodeURIComponent(joinedTo)}`
              )}
            >
              <Download className="h-5 w-5" />
            </IconActionButton>
            <IconActionButton
              title="Download all as JSON"
              ariaLabel="Download all as JSON"
              href={downloadUrl(
                `/api/admin/people?role=${encodeURIComponent(
                  role
                )}&format=json-file&q=${encodeURIComponent(query)}&joinedFrom=${encodeURIComponent(joinedFrom)}&joinedTo=${encodeURIComponent(
                  joinedTo
                )}`
              )}
            >
              <Code2 className="h-5 w-5" />
            </IconActionButton>
            <IconActionButton title="Bulk download selected as CSV" ariaLabel="Bulk download selected as CSV" onClick={() => void bulkDownload()}>
              <ListChecks className="h-5 w-5" />
            </IconActionButton>
            <IconActionButton title="Refresh records" ariaLabel="Refresh records" onClick={() => void load()}>
              <RefreshCw className="h-5 w-5" />
            </IconActionButton>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedIds.length === rows.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? rows.map((r) => r.id) : [])}
                  />
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Name</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Username</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">ID</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Joined</th>
                {role === "STUDENT" && (
                  <>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">XP</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Level</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Enrollments</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Certificates</th>
                  </>
                )}
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.name || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{r.username || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{r.funtId || r.id}</td>
                  <td className="px-3 py-2 text-slate-700">{fmtDate(r.joinedAt)}</td>
                  {role === "STUDENT" && (
                    <>
                      <td className="px-3 py-2 text-slate-700">{r.studentXp ?? 0}</td>
                      <td className="px-3 py-2 text-slate-700">{r.studentLevel ?? 1}</td>
                      <td className="px-3 py-2 text-slate-700">{r.activeEnrollments ?? 0}</td>
                      <td className="px-3 py-2 text-slate-700">{r.certificatesIssued ?? 0}</td>
                    </>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {role === "STUDENT" && (
                        <button
                          type="button"
                          onClick={() => setStudentPreview(r)}
                          title="Quick view student details"
                          aria-label={`Quick view details for ${r.name || r.username || "student"}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                      )}
                      <a
                        href={downloadUrl(`/api/admin/people/${encodeURIComponent(r.id)}/download`)}
                        title="Download person details"
                        aria-label={`Download details for ${r.name || r.username || "user"}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Download className="h-4.5 w-4.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={role === "STUDENT" ? 10 : 6} className="px-3 py-8 text-center text-sm text-slate-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">Page {page} of {pages}</div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Rows:</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value) || 25);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </FormPanel>
      {studentPreview && role === "STUDENT" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Student Quick View</h3>
                <p className="text-xs text-slate-500">Short profile and progress snapshot</p>
              </div>
              <button
                type="button"
                onClick={() => setStudentPreview(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Close student details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-800">{studentPreview.name || "—"}</span></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Username:</span> <span className="font-medium text-slate-800">{studentPreview.username || "—"}</span></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">FUNT ID:</span> <span className="font-medium text-slate-800">{studentPreview.funtId || studentPreview.id}</span></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Joined:</span> <span className="font-medium text-slate-800">{fmtDate(studentPreview.joinedAt)}</span></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">XP:</span> <span className="font-medium text-slate-800">{studentPreview.studentXp ?? 0}</span></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Level:</span> <span className="font-medium text-slate-800">{studentPreview.studentLevel ?? 1}</span></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Enrollments:</span> <span className="font-medium text-slate-800">{studentPreview.activeEnrollments ?? 0}</span></div>
              <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-500">Certificates:</span> <span className="font-medium text-slate-800">{studentPreview.certificatesIssued ?? 0}</span></div>
            </div>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}

