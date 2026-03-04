"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/api";
import { parseJwtPayload, isTrainerOnly } from "@/lib/auth";
import { BATCH_STATUS } from "@funt-platform/constants";
import { SortableTh, type SortDir } from "@/components/ui/SortableTh";
import { BackLink } from "@/components/ui/BackLink";

interface BatchItem {
  id: string;
  name: string;
  batchId?: string;
  trainerId: string;
  startDate: string;
  status: string;
  courseSnapshot?: { title?: string };
  courseSnapshots?: Array<{ title?: string }>;
}

export default function BatchesPage() {
  const [list, setList] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [trainerOnly, setTrainerOnly] = useState(false);
  useEffect(() => {
    setTrainerOnly(isTrainerOnly(parseJwtPayload(getToken())?.roles));
  }, []);

  const sortedList = useMemo(() => {
    if (!sortKey) return list;
    return [...list].sort((a, b) => {
      let av: unknown = (a as Record<string, unknown>)[sortKey];
      let bv: unknown = (b as Record<string, unknown>)[sortKey];
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
      ? `/api/batches?search=${encodeURIComponent(debouncedSearch.trim())}`
      : "/api/batches";
    api<BatchItem[]>(url)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setList(r.data);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackLink href="/dashboard">Back to Dashboard</BackLink>
          {!trainerOnly && (
            <Link
              href="/batches/new"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 hover:shadow-lg"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Batch
            </Link>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Batches</h2>
          <p className="mt-1 text-sm text-slate-600">Create batches and assign courses. Enroll students to give them access.</p>
          <div className="mt-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search batches by name or batch ID…"
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
            <p className="mt-4 text-sm text-slate-500">Loading batches…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="mt-4 text-base font-medium text-slate-700">No batches yet</p>
            <p className="mt-1 text-sm text-slate-500">Create a batch and assign a course to get started.</p>
            <Link
              href="/batches/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-teal-700"
            >
              New Batch
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <SortableTh label="Name" columnKey="name" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Course" columnKey="courseTitle" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Start" columnKey="startDate" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Status" columnKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sortedList.map((b) => (
                  <tr key={b.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{b.name}</td>
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
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/batches/${b.id}/view`}
                          title="View"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/batches/${b.id}`}
                          title="Edit"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        {!trainerOnly && (
                          <Link
                            href={`/batches/${b.id}/duplicate`}
                            title="Duplicate"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
