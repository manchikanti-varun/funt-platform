"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isTrainerOnly } from "@/lib/auth";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { MODULE_STATUS } from "@funt-platform/constants";
import { ROLE } from "@funt-platform/constants";
import { SortableTh, type SortDir } from "@/components/ui/SortableTh";
import { BackLink } from "@/components/ui/BackLink";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { DeleteIconButton, UnarchiveIconButton } from "@/components/ui/actionIconButtons";
import { AppPageShell, DataPanel, useAppDialog, SearchableCourseFilter, CourseQuickPickBar, ChapterListActiveFilters } from "@/components/ui";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { Eye, Search, SquarePen } from "lucide-react";

interface ChapterItem {
  id: string;
  title: string;
  description: string;
  version: number;
  status: string;
}

interface CourseFilterOption {
  id: string;
  title: string;
  chapterCount?: number;
}

interface CoursesApiRow {
  id: string;
  title: string;
  modules?: unknown[];
}

export default function GlobalChaptersPage() {
  const dialog = useAppDialog();
  const { roles } = useAdminUser();
  const router = useRouter();
  const [list, setList] = useState<ChapterItem[]>([]);
  const [courses, setCourses] = useState<CourseFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
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
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
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

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  useEffect(() => {
    setCoursesLoading(true);
    api<CoursesApiRow[]>("/api/courses")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          const sorted = [...r.data]
            .map((c) => ({
              id: c.id,
              title: c.title,
              chapterCount: Array.isArray(c.modules) ? c.modules.length : undefined,
            }))
            .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
          setCourses(sorted);
        }
      })
      .finally(() => setCoursesLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (selectedCourseId) params.set("courseId", selectedCourseId);
    const qs = params.toString();
    const url = qs ? `/api/global-chapters?${qs}` : "/api/global-chapters";
    api<ChapterItem[]>(url)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setList(r.data);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, selectedCourseId]);

  async function handleDuplicate(chapterId: string) {
    setDuplicatingId(chapterId);
    const res = await api<{ id: string }>(`/api/global-chapters/${chapterId}/duplicate`, { method: "POST" });
    setDuplicatingId(null);
    if (res.success && res.data?.id) {
      router.push(`/global-modules/${res.data.id}`);
      return;
    }
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (selectedCourseId) params.set("courseId", selectedCourseId);
    const qs = params.toString();
    const refreshUrl = qs ? `/api/global-chapters?${qs}` : "/api/global-chapters";
    const r = await api<ChapterItem[]>(refreshUrl);
    if (r.success && Array.isArray(r.data)) setList(r.data);
  }

  async function handleDelete(chapterId: string, title: string) {
    const ok = await dialog.confirm({
      title: "Delete chapter",
      message: `Permanently delete chapter "${title}"?\n\nThis cannot be undone. Courses and batches that already include this chapter keep their own snapshot and are not affected.`,
      confirmLabel: "Delete permanently",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(chapterId);
    const res = await api<{ deleted: boolean }>(`/api/global-chapters/${chapterId}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.success) {
      setList((prev) => prev.filter((m) => m.id !== chapterId));
      return;
    }
    await dialog.alert({ title: "Delete failed", message: res.message ?? "Failed to delete chapter." });
  }

  async function handleUnarchive(chapterId: string, title: string) {
    const ok = await dialog.confirm({
      title: "Unarchive chapter",
      message: `Unarchive chapter "${title}"? It will become active again.`,
      confirmLabel: "Unarchive",
    });
    if (!ok) return;
    setUnarchivingId(chapterId);
    const res = await api<ChapterItem>(`/api/global-chapters/${chapterId}/unarchive`, { method: "PATCH" });
    setUnarchivingId(null);
    if (res.success) {
      setList((prev) =>
        prev.map((m) => (m.id === chapterId ? { ...m, status: MODULE_STATUS.ACTIVE } : m))
      );
      return;
    }
    await dialog.alert({ title: "Unarchive failed", message: res.message ?? "Failed to unarchive chapter." });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const ok = await dialog.confirm({
      title: "Bulk delete chapters",
      message: `Permanently delete ${selectedIds.size} selected chapter(s)?\n\nThis cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.size} chapter(s)`,
      variant: "danger",
    });
    if (!ok) return;
    setBulkDeleting(true);
    const res = await api<{ results: { id: string; deleted: boolean; error?: string }[]; deleted: number; failed: number }>(
      "/api/global-chapters/bulk-delete",
      { method: "POST", body: JSON.stringify({ ids: Array.from(selectedIds) }) }
    );
    setBulkDeleting(false);
    if (res.success && res.data) {
      const deletedIds = new Set(res.data.results.filter((r) => r.deleted).map((r) => r.id));
      setList((prev) => prev.filter((m) => !deletedIds.has(m.id)));
      setSelectedIds(new Set());
      if (res.data.failed > 0) {
        const failedItems = res.data.results.filter((r) => !r.deleted);
        await dialog.alert({
          title: "Some chapters could not be deleted",
          message: failedItems.map((r) => `${r.id}: ${r.error}`).join("\n"),
        });
      }
    } else {
      await dialog.alert({ title: "Bulk delete failed", message: res.message ?? "Failed to delete chapters." });
    }
  }

  return (
    <AppPageShell className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.TRAINER]} fallbackHref="/dashboard" />
      <div className="shrink-0 space-y-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink href="/dashboard">Back to Dashboard</BackLink>
          {!readOnly && (
            <Link
              href="/global-modules/new"
              className="btn-primary text-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Chapter
            </Link>
          )}
        </div>
      </div>

      <DataPanel className="min-h-0 flex-1 overflow-auto shadow-xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Global Chapters</h2>
          <p className="mt-1 text-sm text-slate-600">Create and manage chapter templates. Add them to courses in order.</p>
          <div className="mt-5 rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,16rem)]">
              <div>
                <label htmlFor="chapter-search" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="chapter-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search chapters by title or description…"
                    className="input w-full pl-10 pr-3 text-sm"
                  />
                </div>
              </div>
              <SearchableCourseFilter
                value={selectedCourseId}
                onChange={setSelectedCourseId}
                courses={courses}
                loading={coursesLoading}
              />
            </div>
            <CourseQuickPickBar
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              courses={courses}
              loading={coursesLoading}
            />
            <ChapterListActiveFilters
              resultCount={list.length}
              loading={loading}
              search={search}
              selectedCourseTitle={selectedCourse?.title}
              onClearSearch={() => setSearch("")}
              onClearCourse={() => setSelectedCourseId("")}
              onClearAll={() => {
                setSearch("");
                setSelectedCourseId("");
              }}
            />
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="spinner" />
            <p className="mt-4 text-sm text-slate-500">Loading chapters…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="mt-4 text-base font-medium text-slate-700">
              {selectedCourseId || debouncedSearch.trim() ? "No chapters match your filters" : "No chapters yet"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {selectedCourseId || debouncedSearch.trim()
                ? "Try another course or clear the search."
                : "Create your first global chapter to get started."}
            </p>
            {!selectedCourseId && !debouncedSearch.trim() && (
            <Link
              href="/global-modules/new"
              className="btn-primary mt-6 text-sm"
            >
              New Chapter
            </Link>
            )}
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
                  {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size} chapter(s)`}
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
                          setSelectedIds(e.target.checked ? new Set(sortedList.map((m) => m.id)) : new Set())
                        }
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </th>
                  )}
                  <SortableTh label="Title" columnKey="title" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Version" columnKey="version" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Status" columnKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedList.map((m) => (
                  <tr key={m.id} className={`transition hover:bg-slate-50/80 ${selectedIds.has(m.id) ? "bg-teal-50/40" : ""}`}>
                    {isSuperAdmin && (
                      <td className="w-10 px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={() =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(m.id)) next.delete(m.id);
                              else next.add(m.id);
                              return next;
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                    )}
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{m.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">v{m.version}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          m.status === MODULE_STATUS.ARCHIVED
                            ? "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                            : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                        }
                      >
                        {m.status === MODULE_STATUS.ARCHIVED ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/global-modules/${m.id}/view`}
                          title="View"
                          className="admin-table-action"
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Link>
                        {!readOnly && (
                          <Link
                            href={`/global-modules/${m.id}`}
                            title="Edit"
                            className="admin-table-action"
                          >
                            <SquarePen className="h-4 w-4" aria-hidden />
                          </Link>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleDuplicate(m.id)}
                            disabled={duplicatingId !== null}
                            title="Duplicate"
                            className="btn-duplicate btn-duplicate--icon-only"
                          >
                            {duplicatingId === m.id ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" />
                            ) : (
                              <DuplicateIcon />
                            )}
                          </button>
                        )}
                        {!readOnly && m.status === MODULE_STATUS.ARCHIVED && (
                          <UnarchiveIconButton
                            title="Unarchive chapter"
                            onClick={() => handleUnarchive(m.id, m.title)}
                            disabled={unarchivingId !== null}
                          />
                        )}
                        {isSuperAdmin && (
                          <DeleteIconButton
                            title="Delete chapter"
                            onClick={() => handleDelete(m.id, m.title)}
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
