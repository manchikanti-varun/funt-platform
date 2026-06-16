"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { isTrainerOnly } from "@/lib/auth";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { COURSE_STATUS, ROLE } from "@funt-platform/constants";
import { SortableTh, type SortDir } from "@/components/ui/SortableTh";
import { BackLink } from "@/components/ui/BackLink";
import { DuplicateIcon } from "@/components/ui/DuplicateIcon";
import { DeleteIconButton, UnarchiveIconButton } from "@/components/ui/actionIconButtons";
import { AppPageShell, DataPanel, useAppDialog } from "@/components/ui";
import { Eye } from "lucide-react";

interface CourseItem {
  id: string;
  title: string;
  description: string;
  version: number;
  status: string;
  modules?: { length?: number } | unknown[];
}

export default function CoursesPage() {
  const dialog = useAppDialog();
  const { roles } = useAdminUser();
  const [list, setList] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  async function handleDelete(courseId: string, title: string) {
    const ok = await dialog.confirm({
      title: "Delete course",
      message: `Permanently delete course "${title}"?\n\nThis cannot be undone. If any batch still derives from this course, the delete will be refused with details.`,
      confirmLabel: "Delete permanently",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(courseId);
    const res = await api<{ deleted: boolean }>(`/api/courses/${courseId}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.success) {
      setList((prev) => prev.filter((c) => c.id !== courseId));
      return;
    }
    await dialog.alert({ title: "Delete failed", message: res.message ?? "Failed to delete course." });
  }

  async function handleUnarchive(courseId: string, title: string) {
    const ok = await dialog.confirm({
      title: "Unarchive course",
      message: `Unarchive course "${title}"? It will become active again.`,
      confirmLabel: "Unarchive",
    });
    if (!ok) return;
    setUnarchivingId(courseId);
    const res = await api<CourseItem>(`/api/courses/${courseId}/unarchive`, { method: "PATCH" });
    setUnarchivingId(null);
    if (res.success) {
      setList((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, status: COURSE_STATUS.ACTIVE } : c))
      );
      return;
    }
    await dialog.alert({ title: "Unarchive failed", message: res.message ?? "Failed to unarchive course." });
  }

  const sortedList = useMemo(() => {
    if (!sortKey) return list;
    return [...list].sort((a, b) => {
      let av: unknown = (a as unknown as Record<string, unknown>)[sortKey];
      let bv: unknown = (b as unknown as Record<string, unknown>)[sortKey];
      if (sortKey === "modules") {
        av = Array.isArray(a.modules) ? a.modules.length : 0;
        bv = Array.isArray(b.modules) ? b.modules.length : 0;
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
      ? `/api/courses?search=${encodeURIComponent(debouncedSearch.trim())}`
      : "/api/courses";
    api<CourseItem[]>(url)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setList(r.data);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  return (
    <AppPageShell className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink href="/dashboard">Back to Dashboard</BackLink>
          {!readOnly && (
            <Link
                href="/courses/new"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 hover:shadow-lg"
              >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Course
            </Link>
          )}
        </div>
      </div>

      <DataPanel className="min-h-0 flex-1 overflow-auto shadow-xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Courses</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create courses from Global Chapters. Add courses to batches to give students access.
          </p>
          <div className="mt-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses by title or description…"
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
            <p className="mt-4 text-sm text-slate-500">Loading courses…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="mt-4 text-base font-medium text-slate-700">No courses yet</p>
            <p className="mt-1 text-sm text-slate-500">Create your first course by adding Global Chapters in order.</p>
            <Link
              href="/courses/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-teal-700"
            >
              Create Course
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <SortableTh label="Title" columnKey="title" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Description" columnKey="description" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Chapters" columnKey="modules" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Version" columnKey="version" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Status" columnKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedList.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{c.title}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-sm text-slate-600" title={c.description ? c.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""}>
                      {c.description ? c.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "—" : "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {c.modules && Array.isArray(c.modules) ? c.modules.length : 0}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">v{c.version}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          c.status === COURSE_STATUS.ARCHIVED
                            ? "rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                            : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                        }
                      >
                        {c.status === COURSE_STATUS.ARCHIVED ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/courses/${c.id}/view`}
                          title="View"
                          className="admin-table-action"
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Link>
                        {!readOnly && (
                          <Link
                            href={`/courses/${c.id}/duplicate`}
                            title="Duplicate"
                            className="btn-duplicate btn-duplicate--icon-only"
                          >
                            <DuplicateIcon />
                          </Link>
                        )}
                        {!readOnly && c.status === COURSE_STATUS.ARCHIVED && (
                          <UnarchiveIconButton
                            title="Unarchive course"
                            onClick={() => handleUnarchive(c.id, c.title)}
                            disabled={unarchivingId !== null}
                          />
                        )}
                        {isSuperAdmin && (
                          <DeleteIconButton
                            title="Delete course"
                            onClick={() => handleDelete(c.id, c.title)}
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
