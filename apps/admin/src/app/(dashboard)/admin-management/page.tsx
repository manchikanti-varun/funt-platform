"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ROLE } from "@funt-platform/constants";
import { api } from "@/lib/api";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { AppPageShell, FormPanel, PageSection, useAppDialog } from "@/components/ui";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";

type Tab = "requests" | "student" | "trainer" | "admin" | "superAdmin" | "reset";

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

const COUNTRY_CODES = ["+91", "+1", "+44", "+61", "+971", "+65"];
const USERNAME_MIN_LENGTH = 4;
const USERNAME_MAX_LENGTH = 32;
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{3,31}$/;

function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function validateStudentUsernameInput(value: string): string | null {
  const normalized = normalizeUsername(value);
  if (!normalized) return null;
  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return "Use lowercase letters, numbers, dot (.), underscore (_) or hyphen (-) only.";
  }
  if (normalized.endsWith("@funt")) {
    return "This username is reserved.";
  }
  return null;
}

function validateManagementUsernameInput(value: string): string | null {
  const normalized = normalizeUsername(value);
  if (!normalized) return null;
  if (!normalized.endsWith("@funt")) {
    return "Management username must end with @funt.";
  }
  const local = normalized.slice(0, -"@funt".length);
  if (local.length < 1 || local.length > 48) return "Invalid management username length.";
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(local)) {
    return "Invalid characters in management username.";
  }
  return null;
}

function validateStrongPassword(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(value)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(value)) return "Password must contain at least one number.";
  if (!/[!@#$%^&*()_+\-=[\]{};':\"\\|,.<>/?]/.test(value)) return "Password must contain at least one special character.";
  return null;
}

function PasswordRulesHint() {
  return (
    <p className="mt-1 text-xs text-slate-500">
      Password must be at least 8 characters and include at least 1 uppercase letter (A-Z), 1 lowercase letter (a-z), 1 number (0-9), and 1 special character (for example: ! @ # $ %).
    </p>
  );
}

export default function AdminManagementPage() {
  const searchParams = useSearchParams();
  const { roles } = useAdminUser();
  const isSuperAdmin = roles.includes(ROLE.SUPER_ADMIN);
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
    { id: "superAdmin", label: "Create Super Admin", show: isSuperAdmin },
    { id: "reset", label: "Reset Login" },
  ];
  const tabs = allTabs.filter((t) => t.show !== false);

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/dashboard" />
      <PageSection>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Team Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          {isSuperAdmin ? "Review registration requests, create users, and manage logins." : "Create users and reset logins."}
        </p>
        <Link
          href="/profile-search"
          className="mt-3 inline-flex items-center gap-2 btn-secondary text-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Profile Search
        </Link>
      </PageSection>

      {message && (
        <div
          role="alert"
          className={message.type === "success" ? "alert--success" : "alert--error"}
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
            className={`tab-btn ${tab === t.id ? "tab-btn--active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FormPanel className="sm:p-8">
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
        {tab === "superAdmin" && isSuperAdmin && (
          <CreateSuperAdminForm
            onSuccess={(m) => setMessageAndClear("success", m)}
            onError={(m) => setMessageAndClear("error", m)}
          />
        )}
        {tab === "reset" && (
          <ResetLoginForm
            isSuperAdmin={isSuperAdmin}
            onSuccess={(m) => setMessageAndClear("success", m)}
            onError={(m) => setMessageAndClear("error", m)}
          />
        )}
      </FormPanel>
    </AppPageShell>
  );
}

function RegistrationRequestsTab({ onMessage }: { onMessage: (type: "success" | "error", text: string) => void }) {
  const dialog = useAppDialog();
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
    const res = await api<{ username?: string; temporaryPassword?: string; message?: string }>(
      `/api/admin/requests/${requestId}/approve`,
      { method: "POST" }
    );
    setActingId(null);
    if (res.success) {
      onMessage(
        "success",
        res.data?.message ??
          `Account created. Username: ${res.data?.username ?? ""}. Temporary password: ${res.data?.temporaryPassword ?? ""}.`
      );
      load();
    } else {
      onMessage("error", res.message ?? "Failed to approve.");
    }
  }

  async function reject(requestId: string) {
    const reason = await dialog.prompt({
      title: "Reject registration",
      label: "Rejection reason",
      optional: true,
      confirmLabel: "Reject",
    });
    if (reason === null) return;
    setActingId(requestId);
    const res = await api(`/api/admin/requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
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
            Requests from Google Admin signup appear here. Approve or reject to create the account. Use <strong>Refresh</strong> to load the latest.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="input text-sm"
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
        <div className="alert--warning">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex w-full items-center justify-center gap-2 py-8 text-slate-500">
          <span className="spinner spinner--sm" />
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
                        className="btn-approve btn-sm mr-2"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => reject(r.id)}
                        disabled={actingId === r.id}
                        className="btn-reject btn-sm"
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

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        required
        type={show ? "text" : "password"}
        className="input text-sm pr-10"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

function CreateStudentForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("10");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });

  useEffect(() => {
    const candidate = normalizeUsername(username);
    if (!candidate) {
      setUsernameStatus({ checking: false, available: null, message: "" });
      return;
    }
    const validationError = validateStudentUsernameInput(candidate);
    if (validationError) {
      setUsernameStatus({ checking: false, available: false, message: validationError });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUsernameStatus((s) => ({ ...s, checking: true }));
      let res: Response;
      try {
        res = await fetch(`/api/auth/username-availability?username=${encodeURIComponent(candidate)}`, {
          credentials: "include",
          signal: controller.signal,
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setUsernameStatus({ checking: false, available: null, message: "" });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        available?: boolean;
        message?: string;
        data?: { available?: boolean; message?: string };
      };
      if (!res.ok) {
        setUsernameStatus({
          checking: false,
          available: null,
          message: body.message ?? "Could not verify username right now. Try again.",
        });
        return;
      }
      const availableRaw = body.available ?? body.data?.available;
      if (typeof availableRaw !== "boolean") {
        setUsernameStatus({
          checking: false,
          available: null,
          message: body.message ?? "Could not verify username right now. Try again.",
        });
        return;
      }
      const available = availableRaw;
      setUsernameStatus({
        checking: false,
        available,
        message:
          available ? "\u2713 Username available" : "\u2717 Username not available",
      });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [username]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmailFormat(email)) {
      onError("Enter a valid email address.");
      return;
    }
    if (!/^\d{6,15}$/.test(mobileNumber.trim())) {
      onError("Enter a valid mobile number.");
      return;
    }
    if (usernameStatus.available === false) {
      onError(usernameStatus.message || "Username is already taken.");
      return;
    }
    const usernameError = validateStudentUsernameInput(username);
    if (usernameError) {
      onError(usernameError);
      return;
    }
    const pwdErr = validateStrongPassword(password);
    if (pwdErr) {
      onError(pwdErr);
      return;
    }
    if (password !== confirmPassword) {
      onError("Confirm password does not match.");
      return;
    }
    setLoading(true);
    const res = await api<{ username?: string }>("/api/admin/users/student", {
      method: "POST",
      body: JSON.stringify({
        username: normalizeUsername(username),
        name,
        email,
        mobile: `${countryCode}${mobileNumber.trim()}`,
        password,
        age: Number(age),
      }),
    });
    setLoading(false);
    if (res.success) {
      const u = res.data?.username;
      onSuccess(u ? `Student created. Username: ${u}` : "Student created.");
      setUsername(""); setName(""); setEmail(""); setCountryCode("+91");
      setMobileNumber(""); setPassword(""); setConfirmPassword(""); setAge("10");
      setUsernameStatus({ checking: false, available: null, message: "" });
    } else onError(res.message ?? "Failed to create student.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Create Student</h2>
        <p className="mt-1 text-sm text-slate-500">Add a new student with a unique username. They can sign in to the LMS.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="student-username">Username</Label>
          <input
            id="student-username"
            required
            className="input text-sm"
            placeholder="e.g. srikar.ch"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Allowed: 4-32 chars, lowercase letters, numbers, dot (.), underscore (_) or hyphen (-). Example:
            {" "}user.name, user_123, user-dev
          </p>
          {username.trim() ? (
            <p
              className={`mt-1 text-xs ${
                usernameStatus.available === true
                  ? "text-emerald-700"
                  : usernameStatus.available === false
                    ? "text-rose-700"
                    : "text-slate-500"
              }`}
            >
              {usernameStatus.checking ? "Checking availability..." : usernameStatus.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="student-name">Name</Label>
          <input id="student-name" required className="input text-sm" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="student-email">Email</Label>
          <input id="student-email" required type="email" className="input text-sm" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {email.trim() && !isValidEmailFormat(email) ? (
            <p className="mt-1 text-xs text-rose-700">Enter a valid email address</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="student-mobile">Mobile</Label>
          <div className="grid grid-cols-[120px,1fr] gap-2">
            <div className="relative">
              <select
                id="student-country-code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input text-sm appearance-none pr-9"
              >
                {COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.515a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              id="student-mobile"
              required
              className="input text-sm"
              placeholder="9876543210"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="student-age">Age</Label>
          <input
            id="student-age"
            required
            type="number"
            min={7}
            max={120}
            className="input text-sm"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="student-password">Password</Label>
          <PasswordInput id="student-password" placeholder="Initial password" value={password} onChange={setPassword} />
          <PasswordRulesHint />
        </div>
        <div>
          <Label htmlFor="student-confirm-password">Confirm Password</Label>
          <PasswordInput id="student-confirm-password" placeholder="Re-enter password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create Student"}
      </button>
    </form>
  );
}

function CreateTrainerForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });

  useEffect(() => {
    const candidate = normalizeUsername(username);
    if (!candidate) {
      setUsernameStatus({ checking: false, available: null, message: "" });
      return;
    }
    const validationError = validateManagementUsernameInput(candidate);
    if (validationError) {
      setUsernameStatus({ checking: false, available: false, message: validationError });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUsernameStatus((s) => ({ ...s, checking: true }));
      let res: Response;
      try {
        res = await fetch(`/api/auth/username-availability?username=${encodeURIComponent(candidate)}&role=trainer`, {
          credentials: "include",
          signal: controller.signal,
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setUsernameStatus({ checking: false, available: null, message: "" });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        available?: boolean;
        message?: string;
        data?: { available?: boolean; message?: string };
      };
      if (!res.ok) {
        setUsernameStatus({
          checking: false,
          available: null,
          message: body.message ?? "Could not verify username right now. Try again.",
        });
        return;
      }
      const availableRaw = body.available ?? body.data?.available;
      if (typeof availableRaw !== "boolean") {
        setUsernameStatus({
          checking: false,
          available: null,
          message: body.message ?? "Could not verify username right now. Try again.",
        });
        return;
      }
      const available = availableRaw;
      setUsernameStatus({
        checking: false,
        available,
        message:
          available ? "\u2713 Username available" : "\u2717 Username not available",
      });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [username]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmailFormat(email)) {
      onError("Enter a valid email address.");
      return;
    }
    if (!/^\d{6,15}$/.test(mobileNumber.trim())) {
      onError("Enter a valid mobile number.");
      return;
    }
    if (usernameStatus.available === false) {
      onError(usernameStatus.message || "Username is already taken.");
      return;
    }
    const usernameError = validateManagementUsernameInput(username);
    if (usernameError) {
      onError(usernameError);
      return;
    }
    const pwdErr = validateStrongPassword(password);
    if (pwdErr) {
      onError(pwdErr);
      return;
    }
    if (password !== confirmPassword) {
      onError("Confirm password does not match.");
      return;
    }
    setLoading(true);
    const res = await api<{ username?: string }>("/api/admin/users/trainer", {
      method: "POST",
      body: JSON.stringify({
        username: normalizeUsername(username),
        name,
        email,
        mobile: `${countryCode}${mobileNumber.trim()}`,
        password,
      }),
    });
    setLoading(false);
    if (res.success) {
      const u = res.data?.username;
      onSuccess(u ? `Trainer created. Username: ${u}` : "Trainer created.");
      // Reset form after successful creation
      setUsername("");
      setName("");
      setEmail("");
      setCountryCode("+91");
      setMobileNumber("");
      setPassword("");
      setConfirmPassword("");
      setUsernameStatus({ checking: false, available: null, message: "" });
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
          <Label htmlFor="trainer-username">Username</Label>
          <input
            id="trainer-username"
            required
            className="input text-sm"
            placeholder="e.g. trainer.user@funt"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Allowed management username: lowercase local part (letters, numbers, dot/underscore/hyphen) ending with
            {" "}@funt. Example: trainer.user@funt
          </p>
          {username.trim() ? (
            <p
              className={`mt-1 text-xs ${
                usernameStatus.available === true
                  ? "text-emerald-700"
                  : usernameStatus.available === false
                    ? "text-rose-700"
                    : "text-slate-500"
              }`}
            >
              {usernameStatus.checking ? "Checking availability..." : usernameStatus.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="trainer-name">Name</Label>
          <input id="trainer-name" required className="input text-sm" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="trainer-email">Email</Label>
          <input id="trainer-email" required type="email" className="input text-sm" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {email.trim() && !isValidEmailFormat(email) ? (
            <p className="mt-1 text-xs text-rose-700">Enter a valid email address</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="trainer-mobile">Mobile</Label>
          <div className="grid grid-cols-[120px,1fr] gap-2">
            <div className="relative">
              <select
                id="trainer-country-code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input text-sm appearance-none pr-9"
              >
                {COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.515a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              id="trainer-mobile"
              required
              className="input text-sm"
              placeholder="9876543210"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="trainer-password">Password</Label>
          <PasswordInput id="trainer-password" placeholder="Initial password" value={password} onChange={setPassword} />
          <PasswordRulesHint />
        </div>
        <div>
          <Label htmlFor="trainer-confirm-password">Confirm Password</Label>
          <PasswordInput id="trainer-confirm-password" placeholder="Re-enter password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create Trainer"}
      </button>
    </form>
  );
}

function CreateAdminForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmailFormat(email)) {
      onError("Enter a valid email address.");
      return;
    }
    if (!/^\d{6,15}$/.test(mobileNumber.trim())) {
      onError("Enter a valid mobile number.");
      return;
    }
    const pwdErr = validateStrongPassword(password);
    if (pwdErr) {
      onError(pwdErr);
      return;
    }
    if (password !== confirmPassword) {
      onError("Confirm password does not match.");
      return;
    }
    setLoading(true);
    const res = await api<{ username?: string }>("/api/admin/users/admin", {
      method: "POST",
      body: JSON.stringify({ name, email, mobile: `${countryCode}${mobileNumber.trim()}`, password }),
    });
    setLoading(false);
    if (res.success) {
      const u = res.data?.username;
      onSuccess(u ? `Admin created. Username: ${u}` : "Admin created.");
      setName(""); setEmail(""); setCountryCode("+91");
      setMobileNumber(""); setPassword(""); setConfirmPassword("");
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
          <input id="admin-name" required className="input text-sm" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="admin-email">Email</Label>
          <input id="admin-email" required type="email" className="input text-sm" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {email.trim() && !isValidEmailFormat(email) ? (
            <p className="mt-1 text-xs text-rose-700">Enter a valid email address</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="admin-mobile">Mobile</Label>
          <div className="grid grid-cols-[120px,1fr] gap-2">
            <div className="relative">
              <select
                id="admin-country-code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input text-sm appearance-none pr-9"
              >
                {COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.515a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              id="admin-mobile"
              required
              className="input text-sm"
              placeholder="9876543210"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="admin-password">Password</Label>
          <PasswordInput id="admin-password" placeholder="Initial password" value={password} onChange={setPassword} />
          <PasswordRulesHint />
        </div>
        <div>
          <Label htmlFor="admin-confirm-password">Confirm Password</Label>
          <PasswordInput id="admin-confirm-password" placeholder="Re-enter password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create Admin"}
      </button>
    </form>
  );
}

function CreateSuperAdminForm({ onSuccess, onError }: { onSuccess: (m: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmailFormat(email)) {
      onError("Enter a valid email address.");
      return;
    }
    if (!/^\d{6,15}$/.test(mobileNumber.trim())) {
      onError("Enter a valid mobile number.");
      return;
    }
    const pwdErr = validateStrongPassword(password);
    if (pwdErr) {
      onError(pwdErr);
      return;
    }
    if (password !== confirmPassword) {
      onError("Confirm password does not match.");
      return;
    }
    setLoading(true);
    const res = await api<{ username?: string }>("/api/admin/users/super-admin", {
      method: "POST",
      body: JSON.stringify({ name, email, mobile: `${countryCode}${mobileNumber.trim()}`, password }),
    });
    setLoading(false);
    if (res.success) {
      const u = res.data?.username;
      onSuccess(u ? `Super Admin created. Username: ${u}` : "Super Admin created.");
      setName(""); setEmail(""); setCountryCode("+91");
      setMobileNumber(""); setPassword(""); setConfirmPassword("");
    } else onError(res.message ?? "Failed to create super admin.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Create Super Admin</h2>
        <p className="mt-1 text-sm text-slate-500">Super Admin only. Create another Super Admin account directly from Admin panel.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="super-admin-name">Name</Label>
          <input id="super-admin-name" required className="input text-sm" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="super-admin-email">Email</Label>
          <input id="super-admin-email" required type="email" className="input text-sm" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {email.trim() && !isValidEmailFormat(email) ? (
            <p className="mt-1 text-xs text-rose-700">Enter a valid email address</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="super-admin-mobile">Mobile</Label>
          <div className="grid grid-cols-[120px,1fr] gap-2">
            <div className="relative">
              <select
                id="super-admin-country-code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input text-sm appearance-none pr-9"
              >
                {COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.515a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              id="super-admin-mobile"
              required
              className="input text-sm"
              placeholder="9876543210"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="super-admin-password">Password</Label>
          <PasswordInput id="super-admin-password" placeholder="Initial password" value={password} onChange={setPassword} />
          <PasswordRulesHint />
        </div>
        <div>
          <Label htmlFor="super-admin-confirm-password">Confirm Password</Label>
          <PasswordInput id="super-admin-confirm-password" placeholder="Re-enter password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create Super Admin"}
      </button>
    </form>
  );
}

function ResetLoginForm({
  isSuperAdmin,
  onSuccess,
  onError,
}: {
  isSuperAdmin: boolean;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return onError("Username is required.");
    const pwdErr = validateStrongPassword(newPassword);
    if (pwdErr) return onError(pwdErr);
    if (newPassword !== confirmPassword) return onError("Confirm password does not match.");
    setLoading(true);
    const res = await api<{ message?: string }>(
      `/api/admin/users/${encodeURIComponent(username.trim())}/reset-login`,
      { method: "POST", body: JSON.stringify({ newPassword }) }
    );
    setLoading(false);
    if (res.success) {
      onSuccess(res.data?.message ?? "Login reset.");
      setUsername(""); setNewPassword(""); setConfirmPassword("");
    } else onError(res.message ?? "Failed to reset.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Reset Login</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isSuperAdmin
            ? "Clear account lockout and set a new password by username. Super Admins can reset any account (student, trainer, admin, or super admin)."
            : "Clear account lockout and set a new password by username. Admins can only reset student and trainer accounts. Resets for another admin or super admin must be done by a Super Admin."}
        </p>
      </div>
      <div className="max-w-md">
        <Label htmlFor="reset-user">Username</Label>
        <input
          id="reset-user"
          required
          className="input text-sm"
          placeholder="e.g. name@funt"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="max-w-md">
        <Label htmlFor="reset-new-password">New password</Label>
        <PasswordInput id="reset-new-password" value={newPassword} onChange={setNewPassword} />
        <PasswordRulesHint />
      </div>
      <div className="max-w-md">
        <Label htmlFor="reset-confirm-password">Confirm new password</Label>
        <PasswordInput id="reset-confirm-password" value={confirmPassword} onChange={setConfirmPassword} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Resetting…" : "Reset Login"}
      </button>
    </form>
  );
}
