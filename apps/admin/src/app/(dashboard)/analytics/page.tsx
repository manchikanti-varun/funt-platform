"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/api";
import { parseJwtPayload } from "@/lib/auth";
import { ROLE } from "@funt-platform/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface CourseItem {
  id: string;
  title: string;
  status: string;
  modules?: unknown[];
}

interface BatchItem {
  id: string;
  name: string;
  startDate?: string;
  status: string;
}

const COLORS = ["#0d9488", "#7c3aed", "#d97706", "#059669", "#dc2626", "#6366f1"];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [modulesCount, setModulesCount] = useState(0);
  const [assignmentsCount, setAssignmentsCount] = useState(0);

  useEffect(() => {
    const token = getToken();
    const payload = token ? parseJwtPayload(token) : null;
    const isSuperAdmin = payload?.roles?.includes(ROLE.SUPER_ADMIN) ?? false;
    setAllowed(isSuperAdmin);

    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    Promise.all([
      api<CourseItem[]>("/api/courses").then((r) => (Array.isArray(r.data) ? r.data : [])),
      api<BatchItem[]>("/api/batches").then((r) => (Array.isArray(r.data) ? r.data : [])),
      api<unknown[]>("/api/global-modules").then((r) => (Array.isArray(r.data) ? r.data.length : 0)),
      api<unknown[]>("/api/global-assignments").then((r) => (Array.isArray(r.data) ? r.data.length : 0)),
    ])
      .then(([coursesList, batchesList, modCount, assignCount]) => {
        setCourses(Array.isArray(coursesList) ? coursesList : []);
        setBatches(Array.isArray(batchesList) ? batchesList : []);
        setModulesCount(typeof modCount === "number" ? modCount : 0);
        setAssignmentsCount(typeof assignCount === "number" ? assignCount : 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <p className="text-amber-600">Access restricted to Super Admin.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      </div>
    );
  }

  
  const contentBarData = [
    { name: "Courses", count: courses.length, fill: COLORS[0] },
    { name: "Batches", count: batches.length, fill: COLORS[1] },
    { name: "Global Modules", count: modulesCount, fill: COLORS[2] },
    { name: "Global Assignments", count: assignmentsCount, fill: COLORS[3] },
  ];

  
  const batchActive = batches.filter((b) => b.status === "active").length;
  const batchArchived = batches.filter((b) => b.status === "archived").length;
  const batchStatusData = [
    { name: "Active", value: batchActive, color: COLORS[0] },
    { name: "Archived", value: batchArchived, color: COLORS[4] },
  ].filter((d) => d.value > 0);
  if (batchStatusData.length === 0) batchStatusData.push({ name: "No batches", value: 1, color: "#94a3b8" });

  
  const courseActive = courses.filter((c) => c.status === "active").length;
  const courseArchived = courses.filter((c) => c.status === "archived").length;
  const courseStatusData = [
    { name: "Active", value: courseActive, color: COLORS[0] },
    { name: "Archived", value: courseArchived, color: COLORS[4] },
  ].filter((d) => d.value > 0);
  if (courseStatusData.length === 0) courseStatusData.push({ name: "No courses", value: 1, color: "#94a3b8" });

  
  const monthCount: Record<string, number> = {};
  batches.forEach((b) => {
    const d = b.startDate ? (typeof b.startDate === "string" ? b.startDate.slice(0, 7) : "") : "";
    if (d) {
      const label = `${d.slice(0, 4)}-${d.slice(5)}`;
      monthCount[label] = (monthCount[label] ?? 0) + 1;
    }
  });
  const batchesByMonth = Object.entries(monthCount)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, batches: count }));
  if (batchesByMonth.length === 0) batchesByMonth.push({ month: "—", batches: 0 });

  // Modules per course (top courses by module count)
  const courseModuleCounts = courses
    .map((c) => ({
      name: c.title.length > 18 ? c.title.slice(0, 18) + "…" : c.title,
      modules: Array.isArray(c.modules) ? c.modules.length : 0,
    }))
    .sort((a, b) => b.modules - a.modules)
    .slice(0, 8);
  if (courseModuleCounts.length === 0) courseModuleCounts.push({ name: "—", modules: 0 });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">Overview of content and batches. Data from existing APIs.</p>
      </div>

      {}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 border-l-teal-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Courses</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-teal-700">{courses.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 border-l-violet-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Batches</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-700">{batches.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Global Modules</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{modulesCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Global Assignments</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{assignmentsCount}</p>
        </div>
      </div>

      {}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Content overview</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={contentBarData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                formatter={(value: number) => [value, "Count"]}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {contentBarData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Batch status</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={batchStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {batchStatusData.map((_, i) => (
                    <Cell key={i} fill={batchStatusData[i].color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Batches"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Course status</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={courseStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {courseStatusData.map((_, i) => (
                    <Cell key={i} fill={courseStatusData[i].color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Courses"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Batches started by month</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={batchesByMonth} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBatches" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                formatter={(value: number) => [value, "Batches"]}
              />
              <Area type="monotone" dataKey="batches" stroke="#0d9488" strokeWidth={2} fill="url(#colorBatches)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Modules per course (top 8)</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={courseModuleCounts}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" width={76} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                formatter={(value: number) => [value, "Modules"]}
              />
              <Bar dataKey="modules" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
