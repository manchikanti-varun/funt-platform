"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { isTrainerOnly } from "@/lib/auth";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { BATCH_STATUS, ROLE } from "@funt-platform/constants";
import { SortableTh, type SortDir } from "@/components/ui/SortableTh";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { DeleteIconButton, UnarchiveIconButton } from "@/components/ui/actionIconButtons";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppPageShell, DataPanel, useAppDialog } from "@/components/ui";
import { Eye, SquarePen } from "lucide-react";

interface BatchItem {
  id: string;
  name: string;
  batchId?: string;
  trainerId: string;
  trainerName?: string;
  trainerUsername?: string;
  startDate: string;
  status: string;
  visibility?: "PUBLIC" | "PRIVATE";
  isGlobalOnlineBatch?: boolean;
  isNotEnrolledBatch?: boolean;
  courseSnapshot?: { title?: string; courseId?: string };
  courseSnapshots?: Array<{ title?: string; courseId?: string }>;
}

export default function BatchesPage() {
  const dialog = useAppDialog();
  const { roles } = useAdminUser();
  const [list, setList] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "PUBLIC" | "PRIVATE">("ALL");
  const [trainerOnly, setTrainerOnly] = useState(false);
  const isSuperAdmin = roles?.includes(ROLE.SUPER_ADMIN) ?? false;
  useEffect(() => {
    setTrainerOnly(isTrainerOnly(roles));
  }, [roles]);

  async function handleDelete(batchMongoId: string, name: string) {
    const ok = await dialog.confirm({
      title: "Delete batch",
      message: `Permanently delete batch "${name}"?\n\nThis cannot be undone. If any enrolment, submission, attendance or certificate references this batch, the delete will be refused with details.`,
      confirmLabel: "Delete permanently",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(batchMongoId);
    const res = await api<{ deleted: boolean }>(`/api/batches/${batchMongoId}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.success) {
      setList((prev) => prev.filter((b) => b.id !== batchMongoId));
      return;
    }
    await dialog.alert({ title: "Delete failed", message: res.message ?? "Failed to delete batch." });
  }

  async function handleUnarchive(batchMongoId: string, name: string) {
    const ok = await dialog.confirm({
      title: "Unarchive batch",
      message: `Unarchive batch "${name}"? It will become active again.`,
      confirmLabel: "Unarchive",
    });
    if (!ok) return;
    setUnarchivingId(batchMongoId);
    const res = await api<BatchItem>(`/api/batches/${batchMongoId}/unarchive`, { method: "PATCH" });
    setUnarchivingId(null);
    if (res.success) {
      setList((prev) =>
        prev.map((b) => (b.id === batchMongoId ? { ...b, status: BATCH_STATUS.ACTIVE } : b))
      );
      return;
    }
    await dialog.alert({ title: "Unarchive failed", message: res.message ?? "Failed to unarchive batch." });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const ok = await dialog.confirm({
      title: "Bulk delete batches",
      message: `Permanently delete ${selectedIds.size} selected batch(es)?\n\nThis cannot be undone. Batches with enrolments, submissions, or other references will be skipped.`,
      confirmLabel: `Delete ${selectedIds.size} batch(es)`,
      variant: "danger",
    });
    if (!ok) return;
    setBulkDeleting(true);
    const res = await api<{ results: { id: string; deleted: boolean; error?: string }[]; deleted: number; failed: number }>(
      "/api/batches/bulk-delete",
      { method: "POST", body: JSON.stringify({ ids: Array.from(selectedIds) }) }
    );
    setBulkDeleting(false);
    if (res.success && res.data) {
      const deletedIds = new Set(res.data.results.filter((r) => r.deleted).map((r) => r.id));
      setList((prev) => prev.filter((b) => !deletedIds.has(b.id)));
      setSelectedIds(new Set());
      if (res.data.failed > 0) {
        const failedItems = res.data.results.filter((r) => !r.deleted);
        await dialog.alert({
          title: "Some batches could not be deleted",
          message: failedItems.map((r) => `${r.id}: ${r.error}`).join("\n"),
        });
      }
    } else {
      await dialog.alert({ title: "Bulk delete failed", message: res.message ?? "Failed to delete batches." });
    }
  }

  const filteredList = useMemo(() => {
    if (visibilityFilter === "ALL") return list;
    return list.filter((b) => (b.visibility ?? "PUBLIC") === visibilityFilter);
  }, [list, visibilityFilter]);

  const sortedList = useMemo(() => {
    if (!sortKey) return filteredList;
    return [...filteredList].sort((a, b) => {
      let av: unknown = (a as unknown as Record<string, unknown>)[sortKey];
      let bv: unknown = (b as unknown as Record<string, unknown>)[sortKey];
      if (sortKey === "trainerName") {
        av = a.trainerName ?? a.trainerUsername ?? a.trainerId ?? "";
        bv = b.trainerName ?? b.trainerUsername ?? b.trainerId ?? "";
      }
      if (sortKey === "courseTitle") {
        av = Array.isArray(a.courseSnapshots) && a.courseSnapshots.length > 1
          ? `${a.courseSnapshots.length} courses`
          : (a.courseSnapshots?.[0]?.title ?? a.courseSnapshot?.title ?? "");
        bv = Array.isArray(b.courseSnapshots) && b.courseSnapshots.length > 1
          ? `${b.courseSnapshots.length} courses`
          : (b.courseSnapshots?.[0]?.title ?? b.courseSnapshot?.title ?? "");
      }
      const aVal = typeof av === "string" ? av.toLowerCase() : av ?? "";
      const bVal = typeof bv === "string" ? bv.toLowerCase() : bv ?? "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredList, sortKey, sortDir]);

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
      ? `/api/batches?search=${encodeURIComponent(debouncedSearch.trim())}`
      : "/api/batches";
    api<BatchItem[]>(url)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setList(r.data);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  return (
    <AppPageShell className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-6">
        <PageHeader
          title="Batches"
          subtitle="Create and manage batches, course assignment, and student access."
          backHref="/dashboard"
          backLabel="Back to Dashboard"
          actions={
            !trainerOnly ? (
              <Link
                href="/batches/new"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 hover:shadow-lg"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Batch
              </Link>
            ) : null
          }
        />
      </div>

      <DataPanel className="min-h-0 flex-1 overflow-auto shadow-xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">Search</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search batches by name or batch ID…"
              className="input w-full max-w-md"
            />
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Visibility
              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as "ALL" | "PUBLIC" | "PRIVATE")}
                className="input ml-2"
              >
                <option value="ALL">All</option>
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
            </label>
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="spinner" />
            <p className="mt-4 text-sm text-slate-500">Loading batches…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="mt-4 text-base font-medium text-slate-700">No batches yet</p>
            <p className="mt-1 text-sm text-slate-500">Create a batch and assign a course to get started.</p>
            <Link
              href="/batches/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
            >
              Create Batch
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {isSuperAdmin && selectedIds.size > 0 && (
              <div className="flex items-center gap-3 border-b border-rose-100 bg-rose-50 px-5 py-3">
                <span className="text-sm font-medium text-rose-800">{selectedIds.size} selected</span>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
                >
                  {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size} batch(es)`}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Clear selection
                </button>
              </div>
            )}
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {isSuperAdmin && (
                    <th className="w-10 px-3 py-4">
                      <input
                        type="checkbox"
                        checked={sortedList.length > 0 && selectedIds.size === sortedList.length}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? new Set(sortedList.map((b) => b.id)) : new Set())
                        }
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </th>
                  )}
                  <SortableTh label="Name" columnKey="name" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Trainer" columnKey="trainerName" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Course" columnKey="courseTitle" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Start" columnKey="startDate" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Status" columnKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Visibility</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedList.map((b) => (
                  <tr key={b.id} className={`transition hover:bg-slate-50/80 ${selectedIds.has(b.id) ? "bg-teal-50/40" : ""}`}>
                    {isSuperAdmin && (
                      <td className="w-10 px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(b.id)}
                          onChange={() =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(b.id)) next.delete(b.id);
                              else next.add(b.id);
                              return next;
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                    )}
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">
                      {b.name}
                      {b.isGlobalOnlineBatch && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                          Global Online
                        </span>
                      )}
                      {b.isNotEnrolledBatch && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Not Enrolled
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {b.trainerName ? (
                        <span>
                          {b.trainerName}
                          {b.trainerUsername ? <span className="text-slate-500"> · @{b.trainerUsername}</span> : null}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-slate-500" title={b.trainerId}>
                          {b.trainerId.length > 10 ? `${b.trainerId.slice(0, 8)}…` : b.trainerId}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {Array.isArray(b.courseSnapshots) && b.courseSnapshots.length > 1
                        ? `${b.courseSnapshots.length} courses`
                        : (b.courseSnapshots?.[0]?.title ?? b.courseSnapshot?.title ?? "—")}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{typeof b.startDate === "string" ? b.startDate.slice(0, 10) : ""}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          b.status === BATCH_STATUS.ARCHIVED
                            ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                            : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                        }
                      >
                        {b.status === BATCH_STATUS.ARCHIVED ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          b.visibility === "PRIVATE"
                            ? "rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800"
                            : "rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800"
                        }
                      >
                        {b.visibility === "PRIVATE" ? "Private" : "Public"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/batches/${b.id}/view`}
                          title="View"
                          className="admin-table-action"
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Link>
                        <Link
                          href={`/batches/${b.id}`}
                          title="Edit"
                          className="admin-table-action"
                        >
                          <SquarePen className="h-4 w-4" aria-hidden />
                        </Link>
                        {!trainerOnly && (
                          <Link
                            href={`/batches/${b.id}/duplicate`}
                            title="Duplicate"
                            className="btn-duplicate btn-duplicate--icon-only"
                          >
                            <DuplicateIcon />
                          </Link>
                        )}
                        {!trainerOnly && b.status === BATCH_STATUS.ARCHIVED && (
                          <UnarchiveIconButton
                            title="Unarchive batch"
                            onClick={() => handleUnarchive(b.id, b.name)}
                            disabled={unarchivingId !== null}
                          />
                        )}
                        {isSuperAdmin && (
                          <DeleteIconButton
                            title="Delete batch"
                            onClick={() => handleDelete(b.id, b.name)}
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
