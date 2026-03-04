"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ROLE } from "@funt-platform/constants";
import { api } from "@/lib/api";
import { getToken } from "@/lib/api";
import { parseJwtPayload } from "@/lib/auth";

type Tab = "requests" | "student" | "trainer" | "admin" | "parent" | "reset";

interface RegistrationRequestRow {
  id: string;
  roleType: "ADMIN" | "SUPER_ADMIN";
  name: string;
  email: string;
  mobile: string;
  city?: string;
  status: string;
  requestedAt: string;
  requestedBy?: string;
}

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

export default function AdminManagementPage() {
  const searchParams = useSearchParams();
  const payload = parseJwtPayload(getToken() ?? "");
  const isSuperAdmin = payload?.roles?.includes(ROLE.SUPER_ADMIN) ?? false;
  const [tab, setTab] = useState<Tab>("student");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const hasSetInitialTab = useRef(false);

  useEffect(() => {
    if (hasSetInitialTab.current) return;
    hasSetInitialTab.current = true;
    if (searchParams.get("tab") === "requests") setTab("requests");
    else if (isSuperAdmin) setTab("requests");
  }, [searchParams, isSuperAdmin]);

  const setMessageAndClear = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  };

  const allTabs: { id: Tab; label: string; show?: boolean }[] = [
    { id: "requests", label: "Requests" },
    { id: "student", label: "Create Student" },
    { id: "trainer", label: "Create Trainer" },
    { id: "admin", label: "Create Admin", show: isSuperAdmin },
    { id: "parent", label: "Create Parent" },
    { id: "reset", label: "Reset Login" },
  ];
  const tabs = allTabs.filter((t) => t.show !== false);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Admin Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          {isSuperAdmin ? "Review registration requests, create users, and manage logins." : "Create users and reset logins."}
        </p>
        <Link
          href="/profile-search"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/50 hover:text-teal-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Profile Search
        </Link>
      </div>

      {message && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-teal-600 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/20 ring-1 ring-slate-100/80 sm:p-8">
        {tab === "requests" && (
          isSuperAdmin ? (
            <RegistrationRequestsTab onMessage={(type, text) => setMessageAndClear(type, text)} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">Registration requests</p>
              <p className="mt-2 text-sm text-slate-500">
                Only Super Admins can view and approve registration requests here. If you submitted a request (e.g. via Google Admin signup), a Super Admin will review it and you can log in after approval.
              </p>
            </div>
          )
        )}
        {tab === "student" && (
          <CreateStudentForm
            onSuccess={(m) => setMessageAndClear("success", m)}
            onError={(m) => setMessageAndClear("error", m)}
          />
        )}
        {tab === "trainer" && (
          <CreateTrainerForm
            onSuccess={(m) => setMessageAndClear("success", m)}
            onError={(m) => setMessageAndClear("error", m)}
          />
        )}
        {tab === "admin" && isSuperAdmin && (
          <CreateAdminForm
            onSuccess={(m) => setMessageAndClear("success", m)}
            onError={(m) => setMessageAndClear("error", m)}
          />
        )}
        {tab === "parent" && (
          <CreateParentForm
            onSuccess={(m) => setMessageAndClear("success", m)}
            onError={(m) => setMessageAndClear("error", m)}
          />
        )}
        {tab === "reset" && (
          <ResetLoginForm
            onSuccess={(m) => setMessageAndClear("success", m)}
            onError={(m) => setMessageAndClear("error", m)}
          />
        )}
      </div>
    </div>
  );
}

function RegistrationRequestsTab({ onMessage }: { onMessage: (type: "success" | "error", text: string) => void }) {
  const [requests, setRequests] = useState<RegistrationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "">("PENDING");
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    const res = await api<RegistrationRequestRow[]>(`/api/admin/requests?${params.toString()}`);
    setLoading(false);
    if (res.success && Array.isArray(res.data)) {
      setRequests(res.data);
    } else {
      setError(res.message ?? "Failed to load requests. Only Super Admins can view this.");
      setRequests([]);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function approve(requestId: string) {
    setActingId(requestId);
    const res = await api<{ funtId?: string; message?: string }>(`/api/admin/requests/${requestId}/approve`, { method: "POST" });
    setActingId(null);
    if (res.success) {
      onMessage("success", res.data?.message ?? `Account created. FUNT ID: ${res.data?.funtId ?? ""}. Temp password = FUNT ID.`);
      load();
    } else {
      onMessage("error", res.message ?? "Failed to approve.");
    }
  }

  async function reject(requestId: string) {
    const reason = window.prompt("Rejection reason (optional):");
    setActingId(requestId);
    const res = await api(`/api/admin/requests/${requestId}/reject`, { method: "POST", body: JSON.stringify({ reason: reason ?? undefined }) });
    setActingId(null);
    if (res.success) {
      onMessage("success", "Request rejected.");
      load();
    } else {
      onMessage("error", res.message ?? "Failed to reject.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Registration requests</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Requests from Google Admin signup appear here. Approve or reject to create the account (temp password = FUNT ID). Use <strong>Refresh</strong> to load the latest.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </select>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
          Loading requests…
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">
            {statusFilter === "PENDING" ? "No pending requests." : "No requests in this filter."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {statusFilter === "PENDING"
              ? "If you just submitted a request (e.g. via Google Admin signup), click Refresh above to see it here."
              : "Change the status filter to see other requests."}
          </p>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh list
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Mobile</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Requested</th>
                {statusFilter === "PENDING" && (
                  <th className="px-4 py-3 font-semibold text-slate-700 text-right">Actions</th>
                )}
                {statusFilter !== "PENDING" && (
                  <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">{r.roleType === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.email}</td>
                  <td className="px-4 py-3 text-slate-600">{r.mobile}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.requestedAt).toLocaleString()}</td>
                  {statusFilter === "PENDING" && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => approve(r.id)}
                        disabled={actingId === r.id}
                        className="mr-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => reject(r.id)}
                        disabled={actingId === r.id}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </td>
                  )}
                  {statusFilter !== "PENDING" && (
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                        r.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
    </label>
  );
}

function CreateStudentForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await api<{ funtId?: string }>("/api/admin/users/student", {
      method: "POST",
      body: JSON.stringify({ name, email, mobile, password }),
    });
    setLoading(false);
    if (res.success) {
      const funtId = res.data?.funtId;
      onSuccess(funtId ? `Student created. FUNT ID: ${funtId}` : "Student created.");
    } else onError(res.message ?? "Failed to create student.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Create Student</h2>
        <p className="mt-1 text-sm text-slate-500">Add a new student. They will receive a FUNT ID and can sign in to the LMS.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="student-name">Name</Label>
          <input id="student-name" required className={INPUT_CLASS} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="student-email">Email</Label>
          <input id="student-email" required type="email" className={INPUT_CLASS} placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="student-mobile">Mobile</Label>
          <input id="student-mobile" required className={INPUT_CLASS} placeholder="+91 9876543210" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="student-password">Password</Label>
          <input id="student-password" required type="password" className={INPUT_CLASS} placeholder="Initial password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60">
        {loading ? "Creating…" : "Create Student"}
      </button>
    </form>
  );
}

function CreateTrainerForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await api<{ funtId?: string }>("/api/admin/users/trainer", {
      method: "POST",
      body: JSON.stringify({ name, email, mobile, password }),
    });
    setLoading(false);
    if (res.success) {
      const funtId = res.data?.funtId;
      onSuccess(funtId ? `Trainer created. FUNT ID: ${funtId}` : "Trainer created.");
    } else onError(res.message ?? "Failed to create trainer.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Create Trainer</h2>
        <p className="mt-1 text-sm text-slate-500">Add a trainer. They can be assigned to batches and manage their assigned batches in the Trainer Panel.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="trainer-name">Name</Label>
          <input id="trainer-name" required className={INPUT_CLASS} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="trainer-email">Email</Label>
          <input id="trainer-email" required type="email" className={INPUT_CLASS} placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="trainer-mobile">Mobile</Label>
          <input id="trainer-mobile" required className={INPUT_CLASS} placeholder="+91 9876543210" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="trainer-password">Password</Label>
          <input id="trainer-password" required type="password" className={INPUT_CLASS} placeholder="Initial password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60">
        {loading ? "Creating…" : "Create Trainer"}
      </button>
    </form>
  );
}

function CreateAdminForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await api<{ funtId?: string }>("/api/admin/users/admin", {
      method: "POST",
      body: JSON.stringify({ name, email, mobile, password }),
    });
    setLoading(false);
    if (res.success) {
      const funtId = res.data?.funtId;
      onSuccess(funtId ? `Admin created. FUNT ID: ${funtId}` : "Admin created.");
    } else onError(res.message ?? "Failed to create admin.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Create Admin</h2>
        <p className="mt-1 text-sm text-slate-500">Super Admin only. Add an admin to manage content, batches, and operations.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="admin-name">Name</Label>
          <input id="admin-name" required className={INPUT_CLASS} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="admin-email">Email</Label>
          <input id="admin-email" required type="email" className={INPUT_CLASS} placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="admin-mobile">Mobile</Label>
          <input id="admin-mobile" required className={INPUT_CLASS} placeholder="+91 9876543210" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="admin-password">Password</Label>
          <input id="admin-password" required type="password" className={INPUT_CLASS} placeholder="Initial password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60">
        {loading ? "Creating…" : "Create Admin"}
      </button>
    </form>
  );
}

function CreateParentForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [linkedStudentFuntIds, setLinkedStudentFuntIds] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await api<{ funtId?: string }>("/api/admin/users/parent", {
      method: "POST",
      body: JSON.stringify({
        name,
        mobile,
        linkedStudentFuntIds: linkedStudentFuntIds ? linkedStudentFuntIds.split(",").map((s) => s.trim()).filter(Boolean) : [],
      }),
    });
    setLoading(false);
    if (res.success) {
      const funtId = res.data?.funtId;
      onSuccess(funtId ? `Parent created. FUNT ID: ${funtId}` : "Parent created.");
    } else onError(res.message ?? "Failed to create parent.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Create Parent</h2>
        <p className="mt-1 text-sm text-slate-500">Add a parent and optionally link them to students by FUNT ID. Parents can sign in to view linked students.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="parent-name">Name</Label>
          <input id="parent-name" required className={INPUT_CLASS} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="parent-mobile">Mobile</Label>
          <input id="parent-mobile" required className={INPUT_CLASS} placeholder="+91 9876543210" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="parent-students">Linked student FUNT IDs (optional)</Label>
          <input
            id="parent-students"
            className={INPUT_CLASS}
            placeholder="FS-26-00001, FS-26-00002"
            value={linkedStudentFuntIds}
            onChange={(e) => setLinkedStudentFuntIds(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">Comma-separated. Parent can be linked to more students later.</p>
        </div>
      </div>
      <button type="submit" disabled={loading} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60">
        {loading ? "Creating…" : "Create Parent"}
      </button>
    </form>
  );
}

function ResetLoginForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [funtId, setFuntId] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!funtId.trim()) return onError("FUNT ID required.");
    setLoading(true);
    const res = await api(`/api/admin/users/${encodeURIComponent(funtId.trim())}/reset-login`, { method: "POST" });
    setLoading(false);
    if (res.success) onSuccess("Login reset. Password is now their FUNT ID; they can sign in with FUNT ID as both username and password.");
    else onError(res.message ?? "Failed to reset.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Reset Login</h2>
        <p className="mt-1 text-sm text-slate-500">Clear account lockout and set the user&apos;s password to their FUNT ID. They sign in with FUNT ID + FUNT ID as password.</p>
      </div>
      <div className="max-w-md">
        <Label htmlFor="reset-funtid">FUNT ID</Label>
        <input
          id="reset-funtid"
          required
          className={INPUT_CLASS}
          placeholder="e.g. FS-26-00001, AD-26-0001, TR-26-00001"
          value={funtId}
          onChange={(e) => setFuntId(e.target.value)}
        />
      </div>
      <button type="submit" disabled={loading} className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">
        {loading ? "Resetting…" : "Reset Login"}
      </button>
    </form>
  );
}
