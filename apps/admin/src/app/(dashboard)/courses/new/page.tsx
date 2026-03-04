"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

import { RichTextEditor } from "@/components/RichTextEditor";

interface ModuleOption {
  id: string;
  title: string;
  status: string;
}

import { BackLink } from "@/components/ui/BackLink";

export default function NewCoursePage() {
  const router = useRouter();
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [moduleSearch, setModuleSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ModuleOption[]>("/api/global-modules")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setModules(r.data.filter((m) => m.status !== "ARCHIVED"));
      });
  }, []);

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) => m.title.toLowerCase().includes(q));
  }, [modules, moduleSearch]);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function moveUp(i: number) {
    if (i <= 0) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }

  function moveDown(i: number) {
    if (i >= selectedIds.length - 1) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("Select at least one module.");
      return;
    }
    setError("");
    setLoading(true);
    const res = await api<{ id: string }>("/api/courses", {
      method: "POST",
      body: JSON.stringify({ title, description, globalModuleIds: selectedIds }),
    });
    setLoading(false);
    if (res.success && res.data?.id) {
      router.push("/courses");
      return;
    }
    setError(res.message ?? "Failed to create course.");
  }

  const selectedModules = selectedIds.map((id) => modules.find((m) => m.id === id)).filter(Boolean) as ModuleOption[];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-6">
        <BackLink href="/courses">Back to Courses</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">New Course</h2>
          <p className="mt-1 text-sm text-slate-600">Add a title, description, and select Global Modules in the order they will appear in the course.</p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-1">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Course title"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
              <RichTextEditor value={description} onChange={setDescription} minHeight={200} />
              <p className="mt-1 text-xs text-slate-500">Use the toolbar for headers, bold, italic, lists, links, and more.</p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Add Global Modules</h3>
            <p className="mt-1 text-sm text-slate-600">
              Search and select modules. When you have many modules, use the search box to find them quickly. Order the selected list with Up/Down.
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                placeholder="Search modules by title…"
                className="mb-3 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <div className="min-h-0 max-h-72 overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                {filteredModules.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">
                    {moduleSearch.trim() ? "No modules match your search." : "No non-archived modules available. Create some in Global Modules first."}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredModules.map((m) => (
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
                <p className="mb-2 text-sm font-medium text-slate-700">Selected order ({selectedModules.length})</p>
                <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  {selectedModules.map((m, i) => (
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
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(i)}
                          disabled={i === selectedModules.length - 1}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Down
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
