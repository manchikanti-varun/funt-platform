"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageSection } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { ROLE } from "@funt-platform/constants";
import {
  Plus, Settings, Download, CheckCircle2, XCircle, Clock,
  Send, ShieldCheck, Ban, CalendarPlus, Award, Search,
  FileText, UserCheck, UserX, RotateCcw,
} from "lucide-react";

const EMPLOYMENT_TYPES = [
  { value: "INTERN", label: "Intern" },
  { value: "FULL_TIME", label: "Full-Time" },
  { value: "PART_TIME", label: "Part-Time" },
  { value: "CONTRACT", label: "Contract" },
];

const DEPARTMENTS = [
  { value: "ENGINEERING", label: "Engineering" },
  { value: "ROBOTICS", label: "Robotics" },
  { value: "AI", label: "AI" },
  { value: "DESIGN", label: "Design" },
  { value: "MARKETING", label: "Marketing" },
  { value: "EDUCATION", label: "Education" },
  { value: "HR", label: "HR" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "SUPPORT", label: "Support" },
  { value: "FINANCE", label: "Finance" },
];

interface LetterRow {
  _id?: string;
  letterId: string;
  type: string;
  recipientName: string;
  recipientEmail?: string;
  designation: string;
  department: string;
  employmentType: string;
  status: string;
  approvalStatus?: string;
  internResponse?: string;
  linkedLetterId?: string;
  issuedAt: string;
  createdAt?: string;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; label: string; cls: string }> = {
    ACCEPTED: { icon: CheckCircle2, label: "Accepted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    ACTIVE: { icon: CheckCircle2, label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    PENDING_ACCEPTANCE: { icon: Clock, label: "Awaiting Intern", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    PENDING_APPROVAL: { icon: Send, label: "Awaiting Approval", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    DRAFT: { icon: FileText, label: "Draft", cls: "bg-slate-50 text-slate-600 border-slate-200" },
    REJECTED_BY_INTERN: { icon: UserX, label: "Intern Declined", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    EXPIRED: { icon: Clock, label: "Expired", cls: "bg-slate-100 text-slate-500 border-slate-200" },
    WITHDRAWN: { icon: Ban, label: "Withdrawn", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    REVOKED: { icon: XCircle, label: "Revoked", cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const c = config[status] ?? { icon: FileText, label: status, cls: "bg-slate-50 text-slate-600 border-slate-200" };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c.cls}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

export default function LettersPage() {
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientGender, setRecipientGender] = useState("Mr");
  const [employmentType, setEmploymentType] = useState("INTERN");
  const [department, setDepartment] = useState("ENGINEERING");
  const [designation, setDesignation] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState("3 Months");
  const [stipend, setStipend] = useState("");
  const [ctc, setCtc] = useState("");
  const [location, setLocation] = useState("Hyderabad");
  const [reportingTo, setReportingTo] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryRole, setSignatoryRole] = useState("Human Resources");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Modal states
  const [revokeId, setRevokeId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [extendLetterId, setExtendLetterId] = useState("");
  const [extendMonths, setExtendMonths] = useState("3");
  const [extendStipend, setExtendStipend] = useState("");
  const [extendLoading, setExtendLoading] = useState(false);
  const [experienceLetterId, setExperienceLetterId] = useState("");
  const [experienceEndDate, setExperienceEndDate] = useState("");
  const [experienceDuties, setExperienceDuties] = useState("");
  const [experiencePerformance, setExperiencePerformance] = useState("rendered services satisfactorily");
  const [experienceLoading, setExperienceLoading] = useState(false);

  // Template (for preview)
  const [tpl, setTpl] = useState({
    companyName: "FUNT ROBOTICS ACADEMY",
    companyAddress: "2-20-2/211, 1st Floor, Ganesh Nagar, Uppal, Hyderabad, TS PIN: 500039.",
    companyEmail: "info@funt.in", companyWeb: "funt.in",
    offerIntro: 'We are pleased to offer you an Internship at FUNT ROBOTICS (hereinafter referred to as "FRA" or "we") in the position of',
    offerCompletionNote: "Please note that upon successful completion of your internship, you will be eligible for a full-time position or Internship extension with our company, subject to your performance and organizational requirements.",
    offerClosing: "We look forward to working with you.",
    defaultSignatoryName: "Govind Raj", defaultSignatoryRole: "Human Resources",
  });

  useEffect(() => {
    api<Record<string, unknown>>("/api/letters/settings/template")
      .then((r) => { if (r.success && r.data) setTpl((p) => ({ ...p, ...r.data as Record<string, string> })); })
      .catch(() => {});
  }, []);

  async function loadLetters() {
    const qs = new URLSearchParams();
    if (filterType) qs.set("type", filterType);
    if (filterStatus) qs.set("status", filterStatus);
    if (search.trim()) qs.set("search", search.trim());
    const r = await api<LetterRow[]>(`/api/letters?${qs.toString()}`);
    if (r.success && Array.isArray(r.data)) setLetters(r.data);
    setLoading(false);
  }
  useEffect(() => { loadLetters(); }, [filterType, filterStatus, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    if (!recipientName.trim()) { setFormError("Recipient name is required"); return; }
    if (!designation.trim()) { setFormError("Designation is required"); return; }
    if (!joiningDate) { setFormError("Joining date is required"); return; }
    setSubmitting(true);
    const res = await api<{ letterId?: string; id?: string }>("/api/letters", {
      method: "POST",
      body: JSON.stringify({
        type: "OFFER_LETTER",
        recipientName: recipientName.trim(), recipientEmail: recipientEmail.trim() || undefined,
        recipientGender, employmentType, department, designation: designation.trim(),
        joiningDate, endDate: endDate || undefined, duration: duration.trim() || undefined,
        stipend: stipend.trim() || undefined, ctc: ctc.trim() || undefined,
        location: location.trim() || undefined, reportingTo: reportingTo.trim() || undefined,
        responsibilities: responsibilities.trim() || undefined,
        signatoryName: signatoryName.trim() || undefined, signatoryRole: signatoryRole.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (res.success) {
      setFormSuccess(res.data?.letterId ?? res.data?.id ?? "Created");
      setRecipientName(""); setRecipientEmail(""); setDesignation("");
      setJoiningDate(""); setEndDate(""); setStipend(""); setCtc("");
      loadLetters();
    } else { setFormError(res.message ?? "Failed to create letter"); }
  }

  async function handleAction(letterId: string, action: string, body?: Record<string, unknown>) {
    const method = action.startsWith("get") ? "GET" : ["accept","withdraw","revoke","intern-reject"].includes(action) ? "PATCH" : "POST";
    const res = await api(`/api/letters/${letterId}/${action}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (res.success) loadLetters();
    return res;
  }

  async function downloadPdf(letterId: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472"}/api/letters/${letterId}/pdf`, { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${letterId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[ROLE.SUPER_ADMIN, ROLE.ADMIN]} fallbackHref="/dashboard" />
      <PageHeader title="Letters" subtitle="Generate and manage offer letters & experience letters with public verification." />

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" />
          {showForm ? "Close Form" : "New Offer Letter"}
        </button>
        <Link href="/letters/settings" className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
          <Settings className="h-4 w-4" />
          Template Settings
        </Link>
      </div>

      {/* Create Form */}
      {showForm && (
        <DataPanel className="mt-4 overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50/60 via-white to-slate-50 px-6 py-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Generate Offer Letter
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Fill in the intern details. The PDF will be generated matching your template settings.</p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-w-4xl">
            {/* Section: Intern Details */}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Intern Details</p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
              <div>
                <label className="label-sm">Recipient Name *</label>
                <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="input mt-1" placeholder="Full name" />
              </div>
              <div>
                <label className="label-sm">Email</label>
                <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="input mt-1" placeholder="Optional" />
              </div>
              <div>
                <label className="label-sm">Title</label>
                <select value={recipientGender} onChange={(e) => setRecipientGender(e.target.value)} className="input mt-1">
                  <option value="Mr">Mr</option><option value="Ms">Ms</option><option value="Mrs">Mrs</option>
                </select>
              </div>
            </div>
            {/* Section: Position & Role */}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 mt-2">Position &amp; Role</p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
              <div>
                <label className="label-sm">Designation *</label>
                <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="input mt-1" placeholder="e.g. Robotics Trainer" />
              </div>
              <div>
                <label className="label-sm">Department *</label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input mt-1">
                  {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label-sm">Employment Type *</label>
                <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="input mt-1">
                  {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Section: Duration & Dates */}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 mt-2">Duration &amp; Dates</p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
              <div>
                <label className="label-sm">Joining Date *</label>
                <input type="date" value={joiningDate} onChange={(e) => {
                  setJoiningDate(e.target.value);
                  if (employmentType === "INTERN" && duration && e.target.value) {
                    const m = parseInt(duration); if (m > 0) { const d = new Date(e.target.value); d.setMonth(d.getMonth() + m); setEndDate(d.toISOString().split("T")[0]); }
                  }
                }} className="input mt-1" />
              </div>
              {employmentType === "INTERN" && (
                <div>
                  <label className="label-sm">Duration</label>
                  <select value={duration} onChange={(e) => {
                    setDuration(e.target.value);
                    if (joiningDate) { const m = parseInt(e.target.value); if (m > 0) { const d = new Date(joiningDate); d.setMonth(d.getMonth() + m); setEndDate(d.toISOString().split("T")[0]); } }
                  }} className="input mt-1">
                    <option value="1 Months">1 Month</option><option value="2 Months">2 Months</option>
                    <option value="3 Months">3 Months</option><option value="4 Months">4 Months</option>
                    <option value="6 Months">6 Months</option><option value="12 Months">12 Months</option>
                  </select>
                </div>
              )}
              {employmentType === "INTERN" && (
                <div>
                  <label className="label-sm">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-1" />
                  {endDate && <p className="text-[11px] text-slate-500 mt-0.5">Auto-calculated</p>}
                </div>
              )}
            </div>
            {/* Section: Compensation & Reporting */}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 mt-2">Compensation &amp; Reporting</p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
              <div>
                <label className="label-sm">{employmentType === "INTERN" ? "Stipend" : "CTC"}</label>
                {employmentType === "INTERN"
                  ? <input value={stipend} onChange={(e) => setStipend(e.target.value)} className="input mt-1" placeholder="6,000 (Six Thousand Only)" />
                  : <input value={ctc} onChange={(e) => setCtc(e.target.value)} className="input mt-1" placeholder="6,00,000/year" />}
              </div>
              <div>
                <label className="label-sm">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="input mt-1" placeholder="Hyderabad" />
              </div>
              <div>
                <label className="label-sm">Reporting To</label>
                <input value={reportingTo} onChange={(e) => setReportingTo(e.target.value)} className="input mt-1" placeholder="Manager name" />
              </div>
            </div>
            {/* Row 5: Responsibilities */}
            <div>
              <label className="label-sm">Primary Responsibilities</label>
              <input value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} className="input mt-1 w-full" placeholder="e.g. Training & Electronics tasks" />
            </div>
            {/* Section: Signatory */}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 mt-2">Signatory</p>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <div>
                <label className="label-sm">Signatory Name</label>
                <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} className="input mt-1" placeholder={tpl.defaultSignatoryName} />
              </div>
              <div>
                <label className="label-sm">Signatory Role</label>
                <input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} className="input mt-1" placeholder={tpl.defaultSignatoryRole} />
              </div>
            </div>
            {/* Submit */}
            {formError && <p className="text-sm text-red-600 flex items-center gap-1.5"><XCircle className="h-4 w-4" />{formError}</p>}
            {formSuccess && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-medium text-emerald-800">Letter created: {formSuccess}</p>
                <button type="button" onClick={() => downloadPdf(formSuccess)} className="ml-auto btn-primary px-3 py-1.5 text-xs inline-flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
              </div>
            )}
            <button type="submit" disabled={submitting} className="btn-primary px-6 py-2.5 text-sm inline-flex items-center gap-2">
              {submitting ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Generating..." : "Generate Letter"}
            </button>
          </form>

          {/* Live Preview */}
          <div className="border-t border-slate-200 bg-slate-50/50 p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">PDF Preview</p>
            <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-8 font-serif text-[12.5px] leading-[1.8] text-black">
                {/* Letterhead */}
                <div className="flex items-start justify-between mb-1">
                  <div className="w-20 h-14 bg-slate-100 rounded flex items-center justify-center text-[8px] text-slate-400 font-sans">LOGO</div>
                  <div className="text-right text-[8.5px] leading-tight text-slate-600">
                    <p className="font-bold text-black">{tpl.companyName}</p>
                    <p>{tpl.companyAddress}</p>
                    <p>Email: {tpl.companyEmail} ; Web: {tpl.companyWeb}</p>
                  </div>
                </div>
                <hr className="border-black mb-6" />
                <p className="text-right text-[11px] mb-6">{joiningDate ? new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "DD-MM-YYYY"}</p>
                <p className="mb-5">Dear {recipientName || "________"}</p>
                <p className="mb-3">Congratulations! {tpl.offerIntro} &ldquo;<strong>{designation || "________"}</strong>&rdquo;</p>
                {employmentType === "INTERN" && (
                  <p className="mb-3">This internship is for a period of {duration || "3 Months"}, beginning on <strong>{joiningDate ? new Date(joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "________"}</strong> and ending on <strong>{endDate ? new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "________"}</strong>.</p>
                )}
                {reportingTo && <p className="mb-3">As an intern, you will be reporting to Mr. {reportingTo.toUpperCase()}. Your primary responsibilities will include assisting in &ldquo;<strong>{responsibilities || "assigned tasks"}</strong>&rdquo;.</p>}
                {stipend && <p className="mb-3">You will receive a stipend of <strong>INR {stipend}</strong> Per Month.</p>}
                {employmentType === "INTERN" && <p className="mb-3 text-[11.5px]">{tpl.offerCompletionNote}</p>}
                <p className="mb-5">{tpl.offerClosing}</p>
                <p className="mb-4">I, <strong>{recipientName || "________"}</strong>, accept the above offer and agree to join as a {designation || "________"} on {joiningDate ? new Date(joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "________"}.</p>
                <p className="mb-1">Name: <strong>{recipientName || "________"}</strong></p>
                <p className="mb-6 text-[11px] text-slate-500">Signature: _______________________&nbsp;&nbsp;&nbsp;&nbsp;Date: _______________________</p>
                <div className="mt-6 pt-2">
                  <p className="text-[11px]">With Regards,</p>
                  <p className="font-bold text-[11.5px]">{signatoryName || tpl.defaultSignatoryName}</p>
                  <p className="font-bold text-[11.5px]">{signatoryRole || tpl.defaultSignatoryRole}</p>
                  <p className="font-bold text-[11.5px]">{tpl.companyName}</p>
                </div>
              </div>
            </div>
          </div>
        </DataPanel>
      )}

      {/* Filters */}
      <PageSection>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID..." className="input pl-9 text-sm w-60" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input text-sm">
            <option value="">All types</option>
            <option value="OFFER_LETTER">Offer Letters</option>
            <option value="EXPERIENCE_LETTER">Experience Letters</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input text-sm">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="PENDING_ACCEPTANCE">Awaiting Intern</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED_BY_INTERN">Intern Declined</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
      </PageSection>

      {/* Letters Table */}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center"><div className="spinner" /></div>
      ) : letters.length === 0 ? (
        <DataPanel className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">No letters found</p>
          <p className="mt-1 text-xs text-slate-500">Create your first offer letter to get started.</p>
        </DataPanel>
      ) : (
        <DataPanel className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Letter ID</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Recipient</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Designation</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {letters.map((l) => (
                <tr key={l.letterId || l._id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-medium">{l.letterId || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${l.type === "OFFER_LETTER" ? "text-indigo-700" : "text-purple-700"}`}>
                      {l.type === "OFFER_LETTER" ? <FileText className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />}
                      {l.type === "OFFER_LETTER" ? "Offer" : "Experience"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{l.recipientName}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{l.designation}</td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{l.issuedAt ? new Date(l.issuedAt).toLocaleDateString("en-IN") : l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">

                      {/* PDF Download */}
                      {l.letterId && <button onClick={() => downloadPdf(l.letterId)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition" title="Download PDF"><Download className="h-3.5 w-3.5" /></button>}
                      {/* Draft → Submit */}
                      {l.status === "DRAFT" && <button onClick={() => handleAction(l._id || l.letterId, "submit-approval")} className="rounded-lg border border-blue-200 p-1.5 text-blue-600 hover:bg-blue-50 transition" title="Submit for Approval"><Send className="h-3.5 w-3.5" /></button>}
                      {/* Pending Approval → Approve/Reject */}
                      {l.status === "PENDING_APPROVAL" && (
                        <>
                          <button onClick={() => handleAction(l._id || l.letterId, "approve")} className="rounded-lg border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50 transition" title="Approve"><ShieldCheck className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { const r = prompt("Reason?"); if (r) handleAction(l._id || l.letterId, "reject-approval", { reason: r }); }} className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 transition" title="Reject"><XCircle className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                      {/* Pending Acceptance → Accept/Reject/Withdraw */}
                      {l.status === "PENDING_ACCEPTANCE" && (
                        <>
                          <button onClick={() => handleAction(l.letterId, "accept")} className="rounded-lg border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50 transition" title="Intern Accepted"><UserCheck className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleAction(l.letterId, "intern-reject")} className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 transition" title="Intern Declined"><UserX className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleAction(l.letterId, "withdraw")} className="rounded-lg border border-orange-200 p-1.5 text-orange-600 hover:bg-orange-50 transition" title="Withdraw Offer"><Ban className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                      {/* Accepted Offer → Experience + Extend */}
                      {l.status === "ACCEPTED" && l.type === "OFFER_LETTER" && (
                        <>
                          <button onClick={() => { setExperienceLetterId(l.letterId); setExperienceEndDate(""); setExperienceDuties(""); }} className="rounded-lg border border-purple-200 p-1.5 text-purple-600 hover:bg-purple-50 transition" title="Issue Experience Letter"><Award className="h-3.5 w-3.5" /></button>
                          {l.employmentType === "INTERN" && <button onClick={() => { setExtendLetterId(l.letterId); setExtendMonths("3"); }} className="rounded-lg border border-indigo-200 p-1.5 text-indigo-600 hover:bg-indigo-50 transition" title="Extend Internship"><CalendarPlus className="h-3.5 w-3.5" /></button>}
                        </>
                      )}
                      {/* Revoke */}
                      {(l.status === "ACCEPTED" || l.status === "ACTIVE") && <button onClick={() => setRevokeId(l.letterId)} className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 transition" title="Revoke"><XCircle className="h-3.5 w-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}

      {/* ─── Revoke Modal ─── */}
      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100"><XCircle className="h-5 w-5 text-red-600" /></div>
              <div><h3 className="text-base font-bold text-slate-900">Revoke Letter</h3><p className="text-xs text-slate-500">{revokeId}</p></div>
            </div>
            <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} rows={3} placeholder="Reason for revoking this letter..." className="input w-full text-sm" />
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => { setRevokeId(""); setRevokeReason(""); }} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button onClick={async () => { if (!revokeReason.trim()) return; await handleAction(revokeId, "revoke", { reason: revokeReason }); setRevokeId(""); setRevokeReason(""); }} disabled={!revokeReason.trim()} className="btn-primary px-4 py-2 text-sm bg-red-600 hover:bg-red-500">Revoke</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Extend Modal ─── */}
      {extendLetterId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100"><CalendarPlus className="h-5 w-5 text-indigo-600" /></div>
              <div><h3 className="text-base font-bold text-slate-900">Extend Internship</h3><p className="text-xs text-slate-500">Creates a new offer letter continuing from the current end date</p></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label-sm">Extension Duration</label>
                <select value={extendMonths} onChange={(e) => setExtendMonths(e.target.value)} className="input mt-1 w-full">
                  <option value="1">1 Month</option><option value="2">2 Months</option><option value="3">3 Months</option>
                  <option value="4">4 Months</option><option value="6">6 Months</option><option value="12">12 Months</option>
                </select>
              </div>
              <div>
                <label className="label-sm">New Stipend (leave empty to keep same)</label>
                <input value={extendStipend} onChange={(e) => setExtendStipend(e.target.value)} className="input mt-1 w-full" placeholder="e.g. 8,000 (Eight Thousand Rupees Only)" />
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-700 space-y-1">
              <p className="font-semibold">What happens:</p>
              <p>New start date = current end date</p>
              <p>New end date = start + {extendMonths} month{parseInt(extendMonths) > 1 ? "s" : ""}</p>
              <p>{extendStipend ? `Updated stipend: INR ${extendStipend}` : "Same role, stipend & reporting manager"}</p>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setExtendLetterId("")} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button onClick={async () => {
                setExtendLoading(true);
                const res = await api(`/api/letters/${extendLetterId}/extend`, { method: "POST", body: JSON.stringify({ extensionMonths: parseInt(extendMonths), stipend: extendStipend.trim() || undefined }) });
                setExtendLoading(false);
                if (res.success) { setExtendLetterId(""); setExtendStipend(""); loadLetters(); }
              }} disabled={extendLoading} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
                {extendLoading ? <RotateCcw className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                Extend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Experience Letter Modal ─── */}
      {experienceLetterId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100"><Award className="h-5 w-5 text-purple-600" /></div>
              <div><h3 className="text-base font-bold text-slate-900">Issue Experience Letter</h3><p className="text-xs text-slate-500">Based on the accepted offer letter</p></div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-sm">Last Working Day *</label>
                <input type="date" value={experienceEndDate} onChange={(e) => setExperienceEndDate(e.target.value)} className="input mt-1 w-full" />
              </div>
              <div>
                <label className="label-sm">Duties Performed *</label>
                <textarea value={experienceDuties} onChange={(e) => setExperienceDuties(e.target.value)} rows={3} className="input mt-1 w-full" placeholder="Handling Digital and offline marketing initiatives, Training students in Electronics..." />
              </div>
              <div>
                <label className="label-sm">Performance Remark</label>
                <input value={experiencePerformance} onChange={(e) => setExperiencePerformance(e.target.value)} className="input mt-1 w-full" placeholder="rendered services satisfactorily" />
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setExperienceLetterId("")} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button onClick={async () => {
                if (!experienceEndDate || !experienceDuties.trim()) return;
                setExperienceLoading(true);
                const res = await api(`/api/letters/${experienceLetterId}/experience`, {
                  method: "POST", body: JSON.stringify({ endDate: experienceEndDate, dutiesDescription: experienceDuties.trim(), performanceSummary: experiencePerformance.trim() || undefined, signatoryName: signatoryName || undefined, signatoryRole: signatoryRole || undefined }),
                });
                setExperienceLoading(false);
                if (res.success) { setExperienceLetterId(""); loadLetters(); }
              }} disabled={experienceLoading || !experienceEndDate || !experienceDuties.trim()} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
                {experienceLoading ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                Issue Experience Letter
              </button>
            </div>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
