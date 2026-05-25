"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAutoSavedForm } from "@/lib/useAutoSavedForm";

import { RichTextEditor } from "@/components/RichTextEditor";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { DraftRestoredBanner } from "@/components/ui/DraftRestoredBanner";

interface ChapterOption {
  id: string;
  title: string;
  status: string;
}

import { BackLink } from "@/components/ui/BackLink";
import { CourseCardImageField } from "@/components/courses/CourseCardImageField";

interface CourseDraft {
  title: string;
  description: string;
  durationText: string;
  selectedIds: string[];
}

const INITIAL_DRAFT: CourseDraft = {
  title: "",
  description: "",
  durationText: "",
  selectedIds: [],
};

export default function NewCoursePage() {
  const router = useRouter();
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [chapterSearch, setChapterSearch] = useState("");
  const {
    value: form,
    setValue: setForm,
    hasRestoredDraft,
    draftSavedAt,
    discardDraft,
    clearDraft,
  } = useAutoSavedForm<CourseDraft>("courses:new", INITIAL_DRAFT);
  const { title, description, durationText, selectedIds } = form;
  const [headerImageDataUrl, setHeaderImageDataUrl] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof CourseDraft>(field: K, value: CourseDraft[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    api<ChapterOption[]>("/api/global-chapters")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setChapters(r.data.filter((m) => m.status !== "ARCHIVED"));
      });
  }, []);

  const filteredChapters = useMemo(() => {
    const q = chapterSearch.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((m) => m.title.toLowerCase().includes(q));
  }, [chapters, chapterSearch]);

  function toggle(id: string) {
    setForm((prev) => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((x) => x !== id)
        : [...prev.selectedIds, id],
    }));
  }

  function moveUp(i: number) {
    if (i <= 0) return;
    setForm((prev) => {
      const next = [...prev.selectedIds];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return { ...prev, selectedIds: next };
    });
  }

  function moveDown(i: number) {
    setForm((prev) => {
      if (i >= prev.selectedIds.length - 1) return prev;
      const next = [...prev.selectedIds];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return { ...prev, selectedIds: next };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("Select at least one chapter.");
      return;
    }
    setError("");
    setLoading(true);
    const res = await api<{ id: string }>("/api/courses", {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        durationText: durationText.trim(),
        globalChapterIds: selectedIds,
        ...(headerImageDataUrl.trim() ? { headerImageUrl: headerImageDataUrl.trim() } : {}),
        ...(isDemo ? { isDemo: true } : {}),
      }),
    });
    setLoading(false);
    if (res.success && res.data?.id) {
      clearDraft();
      router.push("/courses");
      return;
    }
    setError(res.message ?? "Failed to create course.");
  }

  const selectedChapters = selectedIds.map((id) => chapters.find((m) => m.id === id)).filter(Boolean) as ChapterOption[];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/courses" />
      <div className="shrink-0 pb-6">
        <BackLink href="/courses">Back to Courses</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">New Course</h2>
          <p className="mt-1 text-sm text-slate-600">Add a title, description, and select Global Chapters in the order they will appear in the course.</p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-6">
          {hasRestoredDraft && draftSavedAt !== null && (
            <DraftRestoredBanner savedAt={draftSavedAt} onDiscard={discardDraft} />
          )}
          <div className="grid gap-6 sm:grid-cols-1">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Title</label>
              <input
                required
                value={title}
                onChange={(e) => update("title", e.target.value)}
                className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Course title"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
              <RichTextEditor value={description} onChange={(v) => update("description", v)} minHeight={200} />
              <p className="mt-1 text-xs text-slate-500">Use the toolbar for headers, bold, italic, lists, links, and more.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Duration</label>
              <input
                value={durationText}
                onChange={(e) => update("durationText", e.target.value)}
                className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="e.g. 45 days, 3 months, 12 weeks"
              />
              <p className="mt-1 text-xs text-slate-500">This value will be used on the student certificate.</p>
            </div>
            <CourseCardImageField
              value={headerImageDataUrl}
              onChange={setHeaderImageDataUrl}
              onError={setError}
            />
            <div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
                <input
                  type="checkbox"
                  checked={isDemo}
                  onChange={(e) => setIsDemo(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm text-slate-800">
                  <span className="font-semibold">Demo course</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-600">
                    Free for all students once this course is added to a batch (₹0, auto-enrolled, no invoice). Not visible until it is in a batch.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Add Global Chapters</h3>
            <p className="mt-1 text-sm text-slate-600">
              Search and select chapters. When you have many chapters, use the search box to find them quickly. Order the selected list with Up/Down.
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                placeholder="Search chapters by title…"
                className="mb-3 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <div className="min-h-0 max-h-72 overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                {filteredChapters.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">
                    {chapterSearch.trim() ? "No chapters match your search." : "No non-archived chapters available. Create some in Global Chapters first."}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredChapters.map((m) => (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(m.id)}
                            onChange={() => toggle(m.id)}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm font-medium text-slate-800">{m.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-slate-700">Selected order ({selectedChapters.length})</p>
                <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  {selectedChapters.map((m, i) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                    >
                      <span className="w-6 shrink-0 text-sm font-medium text-slate-500">{i + 1}.</span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 truncate">{m.title}</span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => moveUp(i)}
                          disabled={i === 0}
                          title="Move up"
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(i)}
                          disabled={i === selectedChapters.length - 1}
                          title="Move down"
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            <button
              type="submit"
              disabled={loading || selectedIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating…
                </>
              ) : (
                "Create Course"
              )}
            </button>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
