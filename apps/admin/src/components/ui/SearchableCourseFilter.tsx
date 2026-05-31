"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, Search, X } from "lucide-react";

export interface CourseFilterOption {
  id: string;
  title: string;
  chapterCount?: number;
}

interface SearchableCourseFilterProps {
  value: string;
  onChange: (courseId: string) => void;
  courses: CourseFilterOption[];
  loading?: boolean;
  disabled?: boolean;
}

export function SearchableCourseFilter({
  value,
  onChange,
  courses,
  loading = false,
  disabled = false,
}: SearchableCourseFilterProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => courses.find((c) => c.id === value) ?? null,
    [courses, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title.toLowerCase().includes(q));
  }, [courses, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(t);
    };
  }, [open]);

  function pick(courseId: string) {
    onChange(courseId);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative min-w-[12rem] sm:min-w-[14rem] lg:min-w-[16rem]">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Course
      </label>
      <button
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <BookOpen className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
          {loading ? "Loading courses…" : selected?.title ?? "All courses"}
        </span>
        {selected ? (
          <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
            {selected.chapterCount ?? "—"} ch.
          </span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && !loading ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5"
        >
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            <li role="option" aria-selected={!value}>
              <button
                type="button"
                onClick={() => pick("")}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${!value ? "bg-teal-50 font-semibold text-teal-900" : "text-slate-700"}`}
              >
                <span className="flex-1">All courses</span>
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-500">No courses match your search.</li>
            ) : (
              filtered.map((course) => (
                <li key={course.id} role="option" aria-selected={value === course.id}>
                  <button
                    type="button"
                    onClick={() => pick(course.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${value === course.id ? "bg-teal-50 font-semibold text-teal-900" : "text-slate-700"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{course.title}</span>
                    {typeof course.chapterCount === "number" ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {course.chapterCount} ch.
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface CourseQuickPickBarProps {
  value: string;
  onChange: (courseId: string) => void;
  courses: CourseFilterOption[];
  loading?: boolean;
  quickPickThreshold?: number;
}

/** Horizontal shortcuts for small course lists (hidden when there are many courses). */
export function CourseQuickPickBar({
  value,
  onChange,
  courses,
  loading = false,
  quickPickThreshold = 8,
}: CourseQuickPickBarProps) {
  const show = !loading && courses.length > 0 && courses.length <= quickPickThreshold;
  if (!show) return null;

  return (
    <div className="border-t border-slate-100 pt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick pick</p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onChange("")}
          className={
            value === ""
              ? "shrink-0 rounded-full bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
              : "shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
          }
        >
          All
        </button>
        {courses.map((course) => (
          <button
            key={course.id}
            type="button"
            onClick={() => onChange(course.id)}
            title={course.title}
            className={
              value === course.id
                ? "shrink-0 rounded-full bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
                : "shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
            }
          >
            {course.title}
            {typeof course.chapterCount === "number" ? (
              <span className={value === course.id ? "ml-1 opacity-90" : "ml-1 text-slate-400"}>
                ({course.chapterCount})
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ActiveFilterBarProps {
  resultCount: number;
  loading?: boolean;
  search: string;
  selectedCourseTitle?: string | null;
  onClearSearch: () => void;
  onClearCourse: () => void;
  onClearAll: () => void;
}

export function ChapterListActiveFilters({
  resultCount,
  loading,
  search,
  selectedCourseTitle,
  onClearSearch,
  onClearCourse,
  onClearAll,
}: ActiveFilterBarProps) {
  const hasSearch = !!search.trim();
  const hasCourse = !!selectedCourseTitle;
  if (!hasSearch && !hasCourse) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <span className="text-xs font-medium text-slate-500">
        {loading ? "Filtering…" : `${resultCount} chapter${resultCount === 1 ? "" : "s"}`}
      </span>
      {hasCourse ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 py-1 pl-2.5 pr-1 text-xs font-medium text-teal-900">
          {selectedCourseTitle}
          <button
            type="button"
            onClick={onClearCourse}
            className="rounded-full p-0.5 text-teal-700 transition hover:bg-teal-100"
            aria-label="Clear course filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : null}
      {hasSearch ? (
        <span className="inline-flex max-w-xs items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-700">
          <span className="truncate">Search: {search.trim()}</span>
          <button
            type="button"
            onClick={onClearSearch}
            className="rounded-full p-0.5 text-slate-500 transition hover:bg-slate-200"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : null}
      {(hasSearch && hasCourse) || hasSearch || hasCourse ? (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-auto text-xs font-semibold text-teal-700 transition hover:text-teal-900"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
