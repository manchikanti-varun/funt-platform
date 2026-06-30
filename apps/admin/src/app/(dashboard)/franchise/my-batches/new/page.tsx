"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AppPageShell, FormPanel, PageHeader, Button } from "@/components/ui";

interface CourseOption {
  id: string;
  courseId: string;
  title: string;
  modulesCount: number;
}

interface TrainerOption {
  id: string;
  name: string;
  username: string;
}

export default function FranchiseCreateBatchPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [trainerId, setTrainerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [zoomLink, setZoomLink] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ courses: CourseOption[] }>("/api/franchise/courses"),
      api<{ trainers: TrainerOption[] }>("/api/franchise/trainers"),
    ]).then(([courseRes, trainerRes]) => {
      if (courseRes.success && courseRes.data?.courses) setCourses(courseRes.data.courses);
      if (trainerRes.success && trainerRes.data?.trainers) setTrainers(trainerRes.data.trainers);
    }).finally(() => setLoading(false));
  }, []);

  function toggleCourse(courseId: string) {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Batch name is required"); return; }
    if (selectedCourseIds.length === 0) { setError("Select at least one course"); return; }
    if (!startDate) { setError("Start date is required"); return; }

    setSubmitting(true);
    const res = await api("/api/franchise/batches", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        courseIds: selectedCourseIds,
        trainerId: trainerId || undefined,
        startDate,
        endDate: endDate || undefined,
        zoomLink: zoomLink.trim() || undefined,
      }),
    });
    setSubmitting(false);

    if (res.success) {
      router.push("/franchise/my-batches");
    } else {
      setError(res.message ?? "Failed to create batch");
    }
  }

  return (
    <AppPageShell>
      <PageHeader
        title="Create New Batch"
        subtitle="Pick courses from the global library and create a new batch for your center."
        backHref="/franchise/my-batches"
        backLabel="Back to Batches"
      />

      <FormPanel className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Batch Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Web Dev - July 2027"
              className="input mt-1 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Select Courses *</label>
            <p className="text-xs text-slate-500 mt-1">Pick one or more courses from the global library.</p>
            {loading ? (
              <div className="mt-3 flex justify-center"><div className="spinner" /></div>
            ) : courses.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No courses available.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {courses.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      selectedCourseIds.includes(c.courseId)
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCourseIds.includes(c.courseId)}
                      onChange={() => toggleCourse(c.courseId)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.title}</p>
                      <p className="text-xs text-slate-500">{c.modulesCount} modules</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input mt-1 w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input mt-1 w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Trainer (optional)</label>
            <p className="text-xs text-slate-500 mt-1">Assign a trainer to this batch. Leave empty to use yourself as the trainer.</p>
            <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)} className="input mt-1 w-full">
              <option value="">Myself (default)</option>
              {trainers.map((t) => <option key={t.id} value={t.id}>{t.name} (@{t.username})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Zoom / Meet Link</label>
            <input
              type="url"
              value={zoomLink}
              onChange={(e) => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="input mt-1 w-full"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create Batch"}
            </Button>
            <Button variant="secondary" onClick={() => router.push("/franchise/my-batches")}>
              Cancel
            </Button>
          </div>
        </form>
      </FormPanel>
    </AppPageShell>
  );
}
