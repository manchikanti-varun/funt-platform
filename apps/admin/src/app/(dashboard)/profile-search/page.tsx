"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROLE } from "@funt-platform/constants";
import { api } from "@/lib/api";
import { getToken } from "@/lib/api";
import { parseJwtPayload } from "@/lib/auth";
import Link from "next/link";

interface ProfileUser {
  id: string;
  funtId: string;
  name: string;
  email: string;
  mobile: string;
  roles: string[];
  status: string;
  grade: string;
  schoolName: string;
  city: string;
  createdAt?: string;
  updatedAt?: string;
  linkedStudentFuntIds?: string[];
}

interface ProfileEnrollment {
  batchId: string;
  batchName: string;
  batchStatus: string;
  courseNames: string[];
  status: string;
  enrolledAt: string;
  hasAccess: boolean;
}

interface ProfileCertificate {
  certificateId: string;
  courseName: string;
  issuedAt: string;
}

interface ProfileAttendanceItem {
  batchId: string;
  batchName: string;
  presentCount: number;
  totalSessions: number;
  percentage: number;
}

interface ProfileData {
  user: ProfileUser;
  enrollments?: ProfileEnrollment[];
  certificates?: ProfileCertificate[];
  coursesCount?: number;
  certificatesCount?: number;
  attendanceSummary?: ProfileAttendanceItem[];
}

const ROLE_LABELS: Record<string, string> = {
  [ROLE.STUDENT]: "Student",
  [ROLE.TRAINER]: "Trainer",
  [ROLE.ADMIN]: "Admin",
  [ROLE.SUPER_ADMIN]: "Super Admin",
  [ROLE.PARENT]: "Parent",
};

export default function ProfileSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(qFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const token = getToken();
  const payload = token ? parseJwtPayload(token) : null;
  const isSuperAdmin = payload?.roles?.includes(ROLE.SUPER_ADMIN) ?? false;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError("");
    setProfile(null);
    setLoading(true);
    const res = await api<ProfileData>(`/api/profile/lookup?q=${encodeURIComponent(q)}`);
    setLoading(false);
    if (res.success && res.data) {
      setProfile(res.data);
      router.replace(`/profile-search?q=${encodeURIComponent(q)}`, { scroll: false });
    } else {
      setError(res.message ?? "User not found or you don't have permission to view this profile.");
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return iso;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profile search</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter a student FUNT ID (e.g. FS-26-00001) to view their full profile: courses, batch access (paid), certificates, and attendance.
          {isSuperAdmin && " As Super Admin you can search any user: students, admins, trainers, or super admins."}
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex-1 min-w-[200px]">
          <span className="mb-1 block text-sm font-medium text-slate-700">Student FUNT ID</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. FS-26-00001"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {profile && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100 overflow-hidden">
          {}
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-teal-50/30 px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{profile.user.name}</h2>
                <p className="mt-1 font-mono text-sm text-slate-600">{profile.user.funtId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.user.roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                    >
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      profile.user.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {profile.user.status}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>ID: {profile.user.id}</p>
                {profile.user.createdAt && <p className="mt-1">Joined {formatDate(profile.user.createdAt)}</p>}
              </div>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-800">{profile.user.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Mobile</dt>
                <dd className="font-medium text-slate-800">{profile.user.mobile || "—"}</dd>
              </div>
              {(profile.user.grade || profile.user.schoolName || profile.user.city) && (
                <>
                  {profile.user.grade && (
                    <div>
                      <dt className="text-slate-500">Grade</dt>
                      <dd className="font-medium text-slate-800">{profile.user.grade}</dd>
                    </div>
                  )}
                  {profile.user.schoolName && (
                    <div>
                      <dt className="text-slate-500">School</dt>
                      <dd className="font-medium text-slate-800">{profile.user.schoolName}</dd>
                    </div>
                  )}
                  {profile.user.city && (
                    <div>
                      <dt className="text-slate-500">City</dt>
                      <dd className="font-medium text-slate-800">{profile.user.city}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {profile.user.linkedStudentFuntIds && profile.user.linkedStudentFuntIds.length > 0 && (
              <div className="mt-3">
                <dt className="text-slate-500 text-sm">Linked students (FUNT IDs)</dt>
                <dd className="mt-1 font-mono text-xs text-slate-600">{profile.user.linkedStudentFuntIds.join(", ")}</dd>
              </div>
            )}
          </div>

          {}
          {profile.user.roles.includes(ROLE.STUDENT) && (
            <div className="px-6 pb-6 space-y-6">
              {}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-800">Has access to batch = Paid</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  If this student has access to a batch (is enrolled), they are marked as paid for that batch.
                </p>
              </div>

              {}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                  <p className="text-2xl font-bold text-slate-800">{profile.enrollments?.length ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Batches</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                  <p className="text-2xl font-bold text-slate-800">{profile.coursesCount ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Courses</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                  <p className="text-2xl font-bold text-slate-800">{profile.certificatesCount ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Certificates</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                  <p className="text-2xl font-bold text-emerald-800">{profile.enrollments?.filter((e) => e.hasAccess).length ?? 0}</p>
                  <p className="text-xs font-medium text-emerald-700">Paid (has access)</p>
                </div>
              </div>

              {}
              {profile.enrollments && profile.enrollments.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Batch access (enrolled = paid)</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Batch</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Courses</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Enrolled</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Access</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {profile.enrollments.map((e) => (
                          <tr key={e.batchId} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <Link
                                href={`/batches/${e.batchId}/view`}
                                className="font-medium text-teal-700 hover:underline"
                              >
                                {e.batchName}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{e.courseNames.join(", ") || "—"}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{e.status}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(e.enrolledAt)}</td>
                            <td className="px-4 py-3">
                              {e.hasAccess ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Paid</span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">No access</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {}
              {profile.attendanceSummary && profile.attendanceSummary.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Attendance by batch</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Batch</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Present</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Sessions</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">%</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {profile.attendanceSummary.map((a) => (
                          <tr key={a.batchId} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-800">{a.batchName}</td>
                            <td className="px-4 py-3 text-slate-600">{a.presentCount}</td>
                            <td className="px-4 py-3 text-slate-600">{a.totalSessions}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.percentage >= 75 ? "bg-emerald-100 text-emerald-800" : a.percentage >= 50 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                                {a.percentage}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/batches/${a.batchId}/attendance`} className="text-teal-600 hover:underline text-xs font-medium">
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {}
              {profile.certificates && profile.certificates.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">Certificates</h3>
                  <ul className="space-y-2 rounded-xl border border-slate-200 divide-y divide-slate-200">
                    {profile.certificates.map((c) => (
                      <li key={c.certificateId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50/50">
                        <div>
                          <p className="font-medium text-slate-800">{c.courseName}</p>
                          <p className="font-mono text-xs text-slate-500">{c.certificateId}</p>
                        </div>
                        <span className="text-sm text-slate-600">{formatDate(c.issuedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {(!profile.enrollments || profile.enrollments.length === 0) && (!profile.certificates || profile.certificates.length === 0) && (!profile.attendanceSummary || profile.attendanceSummary.length === 0) && (
                <p className="text-sm text-slate-500">No batch enrollments, attendance, or certificates yet.</p>
              )}
            </div>
          )}

          {}
          {!profile.user.roles.includes(ROLE.STUDENT) && (
            <div className="px-6 pb-6">
              <p className="text-sm text-slate-500">This user is not a student. Only basic profile is shown.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
