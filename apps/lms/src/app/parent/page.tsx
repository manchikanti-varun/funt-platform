"use client";

export default function ParentDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Parent Dashboard</h1>
      <p className="text-slate-600">Read-only view. Link student progress, attendance, Skill Radar, certificates, and achievements here when backend supports parent-linked student data.</p>
      <div className="card text-sm text-slate-600">
        Parent sees linked students (via linkedStudentFuntIds). Use student FUNT ID to fetch progress, attendance, skills, certificates from existing APIs. This is a placeholder; wire to student data when needed.
      </div>
    </div>
  );
}
