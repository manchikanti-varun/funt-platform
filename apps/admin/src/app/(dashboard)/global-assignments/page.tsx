"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isTrainerOnly } from "@/lib/auth";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { ASSIGNMENT_STATUS, ROLE } from "@funt-platform/constants";
import { SortableTh, type SortDir } from "@/components/ui/SortableTh";
import { BackLink } from "@/components/ui/BackLink";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { DeleteIconButton, UnarchiveIconButton } from "@/components/ui/actionIconButtons";
import { AppPageShell, DataPanel, useAppDialog } from "@/components/ui";
import { Eye } from "lucide-react";

interface AssignmentItem {
  id: string;
  title: string;
  submissionType: string;
  skillTags: string[];
  status: string;
  type?: string;
}

export default function GlobalAssignmentsPage() {
  const dialog = useAppDialog();
  const { roles } = useAdminUser();
  const router = useRouter();
  const [list, setList] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [readOnly, setReadOnly] = useState(false);
  const isSuperAdmin = roles?.includes(ROLE.SUPER_ADMIN) ?? false;
  useEffect(() => {
    setReadOnly(isTrainerOnly(roles));
  }, [roles]);

  const sortedList = useMemo(() => {
    if (!sortKey) return list;
    return [...list].sort((a, b) => {
      let av: unknown = (a as unknown as Record<string, unknown>)[sortKey];
      let bv: unknown = (b as unknown as Record<string, unknown>)[sortKey];
      if (sortKey === "skillTags") {
        av = Array.isArray(av) ? av.join(" ") : "";
        bv = Array.isArray(bv) ? bv.join(" ") : "";
      }
      const aVal = typeof av === "string" ? av.toLowerCase() : av ?? "";
      const bVal = typeof bv === "string" ? bv.toLowerCase() : bv ?? "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [list, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const url = debouncedSearch.trim()
      ? `/api/global-assignments?search=${encodeURIComponent(debouncedSearch.trim())}`
      : "/api/global-assignments";
    api<AssignmentItem[]>(url)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setList(r.data);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  async function handleDuplicate(assignmentId: string) {
    setDuplicatingId(assignmentId);
    const res = await api<{ id: string }>(`/api/global-assignments/${assignmentId}/duplicate`, { method: "POST" });
    setDuplicatingId(null);
    if (res.success && res.data?.id) {
      router.push(`/global-assignments/${res.data.id}`);
      return;
    }
    const r = await api<AssignmentItem[]>("/api/global-assignments");
    if (r.success && Array.isArray(r.data)) setList(r.data);
  }

  async function handleDelete(assignmentId: string, title: string) {
    const ok = await dialog.confirm({
      title: "Delete assignment",
      message: `Permanently delete assignment "${title}"?\n\nThis cannot be undone. If any submissions or chapters/courses/batches still reference it, the delete will be refused with details.`,
      confirmLabel: "Delete permanently",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(assignmentId);
    const res = await api<{ deleted: boolean }>(`/api/global-assignments/${assignmentId}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.success) {
      setList((prev) => prev.filter((a) => a.id !== assignmentId));
      return;
    }
    await dialog.alert({ title: "Delete failed", message: res.message ?? "Failed to delete assignment." });
  }

  async function handleUnarchive(assignmentId: string, title: string) {
    const ok = await dialog.confirm({
      title: "Unarchive assignment",
      message: `Unarchive assignment "${title}"? It will become active again.`,
      confirmLabel: "Unarchive",
    });
    if (!ok) return;
    setUnarchivingId(assignmentId);
    const res = await api<AssignmentItem>(`/api/global-assignments/${assignmentId}/unarchive`, { method: "PATCH" });
    setUnarchivingId(null);
    if (res.success) {
      setList((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, status: ASSIGNMENT_STATUS.ACTIVE } : a))
      );
      return;
    }
    await dialog.alert({ title: "Unarchive failed", message: res.message ?? "Failed to unarchive assignment." });
  }

  return (
    <AppPageShell className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink href="/dashboard">Back to Dashboard</BackLink>
          {!readOnly && (
            <Link
              href="/global-assignments/new"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 hover:shadow-lg"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Assignment
            </Link>
          )}
        </div>
      </div>

      <DataPanel className="min-h-0 flex-1 overflow-auto shadow-xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Global Assignments</h2>
          <p className="mt-1 text-sm text-slate-600">Create and manage assignment templates. Link them to chapters in Global Chapters.</p>
          <div className="mt-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assignments by title or instructions…"
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
            <p className="mt-4 text-sm text-slate-500">Loading assignments…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="mt-4 text-base font-medium text-slate-700">No assignments yet</p>
            <p className="mt-1 text-sm text-slate-500">Create your first global assignment to get started.</p>
            <Link
              href="/global-assignments/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-teal-700"
            >
              New Assignment
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <SortableTh label="Title" columnKey="title" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Type" columnKey="type" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Skills" columnKey="skillTags" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Status" columnKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedList.map((a) => (
                  <tr key={a.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{a.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{a.type === "general" ? "General" : "Chapter"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{(a.skillTags ?? []).join(", ") || "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          a.status === ASSIGNMENT_STATUS.ARCHIVED
                            ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                            : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                        }
                      >
                        {a.status === ASSIGNMENT_STATUS.ARCHIVED ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/global-assignments/${a.id}/view`}
                          title="View"
                          className="admin-table-action"
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Link>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleDuplicate(a.id)}
                            disabled={duplicatingId !== null}
                            title="Duplicate"
                            className="btn-duplicate btn-duplicate--icon-only"
                          >
                            {duplicatingId === a.id ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" />
                            ) : (
                              <DuplicateIcon />
                            )}
                          </button>
                        )}
                        {!readOnly && a.status === ASSIGNMENT_STATUS.ARCHIVED && (
                          <UnarchiveIconButton
                            title="Unarchive assignment"
                            onClick={() => handleUnarchive(a.id, a.title)}
                            disabled={unarchivingId !== null}
                          />
                        )}
                        {isSuperAdmin && (
                          <DeleteIconButton
                            title="Delete assignment"
                            onClick={() => handleDelete(a.id, a.title)}
                            disabled={deletingId !== null}
                          />
                        )}
                      </div>
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
