"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, PageHeader } from "@/components/ui";

interface CourseItem {
  id: string;
  courseId: string;
  title: string;
  description: string;
  headerImageUrl: string;
  durationText: string;
  ageGroup: string;
  modulesCount: number;
}

export default function FranchiseCoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ courses: CourseItem[] }>("/api/franchise/courses")
      .then((r) => { if (r.success && r.data?.courses) setCourses(r.data.courses); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppPageShell>
      <PageHeader
        title="Course Library"
        subtitle="Browse available courses. Use these when creating a batch."
      />

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : courses.length === 0 ? (
        <div className="mt-6 text-center py-16 text-slate-500">No courses available.</div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {c.headerImageUrl && (
                <div className="h-36 w-full overflow-hidden bg-slate-100">
                  <img src={c.headerImageUrl} alt={c.title} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-800">{c.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-0.5">{c.modulesCount} modules</span>
                  {c.durationText && <span className="rounded bg-slate-100 px-2 py-0.5">{c.durationText}</span>}
                  {c.ageGroup && <span className="rounded bg-slate-100 px-2 py-0.5">{c.ageGroup}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppPageShell>
  );
}
