"use client";

export default function ParentDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Parent Dashboard</h1>
      <p className="text-slate-600">Read-only view. Link student progress, attendance, Skill Radar, certificates, and achievements here when backend supports parent-linked student data.</p>
      <div className="card text-sm text-slate-600">
        Parent sees linked students (via linked student usernames). Use those usernames with existing APIs when wiring student data. This is a placeholder.
      </div>
    </div>
  );
}
