"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppPageShell, DataPanel, PageSection } from "@/components/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireRoles } from "@/components/auth/RequireRoles";
import { ROLE } from "@funt-platform/constants";

const LETTER_TYPES = [
  { value: "OFFER_LETTER", label: "Offer Letter" },
  { value: "EXPERIENCE_LETTER", label: "Experience Letter" },
];

const EMPLOYMENT_TYPES = [
  { value: "INTERN", label: "Intern" },
  { value: "FULL_TIME", label: "Full-Time" },
  { value: "PART_TIME", label: "Part-Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OTHER", label: "Other (type below)" },
];

const DEPARTMENTS = [
  { value: "ENGINEERING", label: "Engineering" },
  { value: "DESIGN", label: "Design" },
  { value: "SUPPORT", label: "Support" },
  { value: "MARKETING", label: "Marketing" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "EDUCATION", label: "Education" },
  { value: "HR", label: "HR" },
  { value: "FINANCE", label: "Finance" },
  { value: "OTHER", label: "Other (type below)" },
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
  internRejectReason?: string;
  linkedLetterId?: string;
  issuedAt: string;
  createdAt?: string;
}

export default function LettersPage() {
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showSample, setShowSample] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("OFFER_LETTER");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [employmentType, setEmploymentType] = useState("INTERN");
  const [customEmploymentType, setCustomEmploymentType] = useState("");
  const [department, setDepartment] = useState("ENGINEERING");
  const [customDepartment, setCustomDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState("3 Months");
  const [stipend, setStipend] = useState("");
  const [ctc, setCtc] = useState("");
  const [location, setLocation] = useState("Remote");
  const [reportingTo, setReportingTo] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [performanceSummary, setPerformanceSummary] = useState("");
  const [dutiesDescription, setDutiesDescription] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryRole, setSignatoryRole] = useState("Human Resources");
  const [recipientGender, setRecipientGender] = useState("Mr");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Revoke state
  const [revokeId, setRevokeId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

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
    setFormError("");
    setFormSuccess("");
    if (!recipientName.trim()) { setFormError("Recipient name is required"); return; }
    if (!designation.trim()) { setFormError("Designation is required"); return; }
    if (!joiningDate) { setFormError("Joining date is required"); return; }
    if (formType === "EXPERIENCE_LETTER" && !endDate) { setFormError("End date is required for experience letters"); return; }

    setSubmitting(true);
    const finalEmploymentType = employmentType === "OTHER" ? customEmploymentType.trim() : employmentType;
    const finalDepartment = department === "OTHER" ? customDepartment.trim() : department;
    if (employmentType === "OTHER" && !customEmploymentType.trim()) { setFormError("Please enter the employment type"); setSubmitting(false); return; }
    if (department === "OTHER" && !customDepartment.trim()) { setFormError("Please enter the department"); setSubmitting(false); return; }
    const res = await api<{ letterId: string }>("/api/letters", {
      method: "POST",
      body: JSON.stringify({
        type: formType,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim() || undefined,
        recipientGender,
        employmentType: finalEmploymentType,
        department: finalDepartment,
        designation: designation.trim(),
        joiningDate,
        endDate: endDate || undefined,
        duration: duration.trim() || undefined,
        stipend: stipend.trim() || undefined,
        ctc: ctc.trim() || undefined,
        location: location.trim() || undefined,
        reportingTo: reportingTo.trim() || undefined,
        responsibilities: responsibilities.trim() || undefined,
        performanceSummary: performanceSummary.trim() || undefined,
        dutiesDescription: dutiesDescription.trim() || undefined,
        signatoryName: signatoryName.trim() || undefined,
        signatoryRole: signatoryRole.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (res.success && res.data) {
      setFormSuccess(res.data.letterId);
      resetForm();
      loadLetters();
    } else {
      setFormError(res.message ?? "Failed to create letter");
    }
  }

  function resetForm() {
    setRecipientName("");
    setRecipientEmail("");
    setDesignation("");
    setJoiningDate("");
    setEndDate("");
    setStipend("");
    setCtc("");
    setLocation("Remote");
    setReportingTo("");
    setPerformanceSummary("");
  }

  async function handleRevoke() {
    if (!revokeId || !revokeReason.trim()) return;
    const res = await api(`/api/letters/${revokeId}/revoke`, {
      method: "PATCH",
      body: JSON.stringify({ reason: revokeReason.trim() }),
    });
    if (res.success) {
      setRevokeId("");
      setRevokeReason("");
      loadLetters();
    }
  }

  async function handleAccept(id: string) {
    const res = await api(`/api/letters/${id}/accept`, { method: "PATCH" });
    if (res.success) loadLetters();
  }

  async function handleWithdraw(id: string) {
    if (!confirm("Withdraw this offer? The candidate will no longer be able to accept it.")) return;
    const res = await api(`/api/letters/${id}/withdraw`, { method: "PATCH" });
    if (res.success) loadLetters();
  }

  return (
    <AppPageShell className="w-full">
      <RequireRoles roles={[ROLE.SUPER_ADMIN, ROLE.ADMIN]} fallbackHref="/dashboard" />
      <PageHeader
        title="Letters"
        subtitle="Generate offer letters and experience letters. Anyone can verify them publicly."
      />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary px-4 py-2 text-sm">
          {showForm ? "Hide form" : "+ Generate letter"}
        </button>
        <button onClick={() => setShowSample((v) => !v)} className="btn-secondary px-4 py-2 text-sm">
          {showSample ? "Hide sample" : "View sample"}
        </button>
      </div>

      {showSample && (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Sample Offer Letter */}
          <DataPanel className="p-0 overflow-hidden">
            <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Sample — Offer Letter</p>
            </div>
            <div className="p-6 font-serif text-[12px] leading-relaxed text-slate-800">
              <div className="text-center border-b-2 border-indigo-600 pb-3 mb-5">
                <p className="text-lg font-bold text-slate-900">FUNT Robotics Academy</p>
                <p className="text-[10px] text-slate-500">Building tomorrow&apos;s innovators</p>
              </div>
              <div className="text-center mb-5">
                <p className="text-base font-bold text-indigo-700">OFFER LETTER</p>
                <p className="text-[10px] text-slate-500 mt-1">Ref: LTR-000042 &nbsp;|&nbsp; Date: 10 July 2026</p>
              </div>
              <p>Dear <span className="font-semibold">Rahul Sharma</span>,</p>
              <p className="mt-2">We are pleased to offer you the position of <span className="font-semibold">Frontend Developer Intern</span> in the <span className="font-semibold">Engineering</span> department at FUNT Robotics Academy as an <span className="font-semibold">Intern</span>.</p>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] space-y-1">
                <p><span className="font-bold">Position:</span> Frontend Developer Intern</p>
                <p><span className="font-bold">Department:</span> Engineering</p>
                <p><span className="font-bold">Employment Type:</span> Intern</p>
                <p><span className="font-bold">Date of Joining:</span> 15 July 2026</p>
                <p><span className="font-bold">Location:</span> Remote</p>
                <p><span className="font-bold">Stipend:</span> ₹10,000/month</p>
                <p><span className="font-bold">Reporting To:</span> Varun M.</p>
              </div>
              <p className="mt-3">We are confident that your skills and experience will be a great asset to our team. Please confirm your acceptance of this offer.</p>
              <p className="mt-2">We look forward to welcoming you aboard.</p>
              <div className="mt-6">
                <p className="font-bold">For FUNT Robotics Academy</p>
                <div className="mt-4 w-32 border-t border-slate-400" />
                <p className="text-[10px] text-slate-500">Authorized Signatory</p>
              </div>
              <div className="mt-6 border-t border-slate-200 pt-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded border border-slate-200 bg-slate-50">
                  <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" /><circle cx="17.5" cy="17.5" r="3.5" /></svg>
                </div>
                <div className="text-[9px] text-slate-400 space-y-0.5">
                  <p>Verify: https://api.funt.in/verify/letter/LTR-000042</p>
                  <p>Letter ID: LTR-000042</p>
                  <p className="font-medium text-slate-500">✓ Digitally signed by FUNT Robotics Academy</p>
                  <p>This is a system-generated document and does not require a physical signature.</p>
                </div>
              </div>
            </div>
          </DataPanel>

          {/* Sample Experience Letter */}
          <DataPanel className="p-0 overflow-hidden">
            <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Sample — Experience Letter</p>
            </div>
            <div className="p-6 font-serif text-[12px] leading-relaxed text-slate-800">
              <div className="text-center border-b-2 border-indigo-600 pb-3 mb-5">
                <p className="text-lg font-bold text-slate-900">FUNT Robotics Academy</p>
                <p className="text-[10px] text-slate-500">Building tomorrow&apos;s innovators</p>
              </div>
              <div className="text-center mb-5">
                <p className="text-base font-bold text-indigo-700">EXPERIENCE LETTER</p>
                <p className="text-[10px] text-slate-500 mt-1">Ref: LTR-000058 &nbsp;|&nbsp; Date: 10 July 2026</p>
              </div>
              <p className="font-bold">To Whom It May Concern</p>
              <p className="mt-3">This is to certify that <span className="font-semibold">Priya Patel</span> was associated with FUNT Robotics Academy as a <span className="font-semibold">Full-Time Employee</span> in the <span className="font-semibold">Design</span> department from <span className="font-semibold">01 January 2025</span> to <span className="font-semibold">30 June 2026</span>.</p>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] space-y-1">
                <p><span className="font-bold">Name:</span> Priya Patel</p>
                <p><span className="font-bold">Designation:</span> UI/UX Designer</p>
                <p><span className="font-bold">Department:</span> Design</p>
                <p><span className="font-bold">Employment Type:</span> Full-Time Employee</p>
                <p><span className="font-bold">Period:</span> 01 January 2025 to 30 June 2026</p>
              </div>
              <div className="mt-3">
                <p className="font-bold text-[11px]">Performance Summary:</p>
                <p className="mt-1">Priya demonstrated exceptional creativity and attention to detail. She led the redesign of our student dashboard and contributed significantly to our brand identity system. A highly reliable team member.</p>
              </div>
              <p className="mt-3">During the tenure, Priya Patel demonstrated professionalism and dedication. We wish all the best for future endeavors.</p>
              <div className="mt-6">
                <p className="font-bold">For FUNT Robotics Academy</p>
                <div className="mt-4 w-32 border-t border-slate-400" />
                <p className="text-[10px] text-slate-500">Authorized Signatory</p>
              </div>
              <div className="mt-6 border-t border-slate-200 pt-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded border border-slate-200 bg-slate-50">
                  <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" /><circle cx="17.5" cy="17.5" r="3.5" /></svg>
                </div>
                <div className="text-[9px] text-slate-400 space-y-0.5">
                  <p>Verify: https://api.funt.in/verify/letter/LTR-000058</p>
                  <p>Letter ID: LTR-000058</p>
                  <p className="font-medium text-slate-500">✓ Digitally signed by FUNT Robotics Academy</p>
                  <p>This is a system-generated document and does not require a physical signature.</p>
                </div>
              </div>
            </div>
          </DataPanel>
        </div>
      )}

      {showForm && (
        <DataPanel className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Letter Type *</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="input mt-1 text-sm">
                  {LETTER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Employment Type *</label>
                <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="input mt-1 text-sm">
                  {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {employmentType === "OTHER" && (
                  <input value={customEmploymentType} onChange={(e) => setCustomEmploymentType(e.target.value)} className="input mt-2 text-sm" placeholder="Type employment type..." />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Recipient Name *</label>
                <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="input mt-1 text-sm" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Recipient Email</label>
                <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="input mt-1 text-sm" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Designation *</label>
                <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="input mt-1 text-sm" placeholder="e.g. Frontend Developer Intern" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Department *</label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input mt-1 text-sm">
                  {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                {department === "OTHER" && (
                  <input value={customDepartment} onChange={(e) => setCustomDepartment(e.target.value)} className="input mt-2 text-sm" placeholder="Type department name..." />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Joining Date *</label>
                <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className="input mt-1 text-sm" />
              </div>
              {formType === "EXPERIENCE_LETTER" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">End Date *</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-1 text-sm" />
                </div>
              )}
              {formType === "OFFER_LETTER" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Duration (for interns)</label>
                    <input value={duration} onChange={(e) => setDuration(e.target.value)} className="input mt-1 text-sm" placeholder="e.g. 3 Months" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">End Date</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-1 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Stipend</label>
                    <input value={stipend} onChange={(e) => setStipend(e.target.value)} className="input mt-1 text-sm" placeholder="e.g. 6,000 (Six Thousand Rupees Only)" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">CTC</label>
                    <input value={ctc} onChange={(e) => setCtc(e.target.value)} className="input mt-1 text-sm" placeholder="e.g. 6,00,000/year" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Location</label>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} className="input mt-1 text-sm" placeholder="Remote" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Reporting To</label>
                    <input value={reportingTo} onChange={(e) => setReportingTo(e.target.value)} className="input mt-1 text-sm" placeholder="Manager name" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Primary Responsibilities</label>
                    <input value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} className="input mt-1 text-sm" placeholder="e.g. Training & Electronics tasks" />
                  </div>
                </>
              )}
            </div>
            {formType === "EXPERIENCE_LETTER" && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Duties Description *</label>
                <textarea value={dutiesDescription} onChange={(e) => setDutiesDescription(e.target.value)} rows={3} className="input mt-1 text-sm w-full" placeholder="e.g. Handling Digital and offline marketing initiatives" />
              </div>
            )}
            {formType === "EXPERIENCE_LETTER" && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Performance Summary</label>
                <textarea value={performanceSummary} onChange={(e) => setPerformanceSummary(e.target.value)} rows={3} className="input mt-1 text-sm w-full" placeholder="e.g. rendered his services satisfactorily" />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-200 pt-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Gender/Title</label>
                <select value={recipientGender} onChange={(e) => setRecipientGender(e.target.value)} className="input mt-1 text-sm">
                  <option value="Mr">Mr</option>
                  <option value="Ms">Ms</option>
                  <option value="Mrs">Mrs</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Signatory Name</label>
                <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} className="input mt-1 text-sm" placeholder="e.g. Govind Raj or Srikar Reddy" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Signatory Role</label>
                <input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} className="input mt-1 text-sm" placeholder="e.g. Human Resources / Manager" />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            {formSuccess && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-medium text-emerald-800">✓ Letter created: {formSuccess}</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472"}/api/letters/${formSuccess}/pdf`, { credentials: "include" });
                      if (!res.ok) return;
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${formSuccess}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch { /* ignore */ }
                  }}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  Download PDF
                </button>
              </div>
            )}
            <button type="submit" disabled={submitting} className="btn-primary px-6 py-2 text-sm">
              {submitting ? "Generating..." : "Generate Letter"}
            </button>
          </form>

          {/* Live Preview */}
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Live Preview</p>
            <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm font-serif text-[13px] leading-relaxed text-slate-800">
              {/* Header */}
              <div className="text-center border-b-2 border-indigo-600 pb-4 mb-6">
                <p className="text-xl font-bold text-slate-900 tracking-tight">FUNT Robotics Academy</p>
                <p className="text-xs text-slate-500 mt-0.5">Building tomorrow&apos;s innovators</p>
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <p className="text-lg font-bold text-indigo-700">
                  {formType === "OFFER_LETTER" ? "OFFER LETTER" : "EXPERIENCE LETTER"}
                </p>
                <p className="text-xs text-slate-500 mt-1">Ref: LTR-XXXXXX</p>
                <p className="text-xs text-slate-500">Date: {joiningDate ? new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "DD Month YYYY"}</p>
              </div>

              {/* Body */}
              {formType === "OFFER_LETTER" ? (
                <div className="space-y-3">
                  <p>Dear <span className="font-semibold">{recipientName || "________"}</span>,</p>
                  <p>
                    We are pleased to offer you the position of <span className="font-semibold">{designation || "________"}</span> in the{" "}
                    <span className="font-semibold">{department === "OTHER" ? (customDepartment || "________") : (DEPARTMENTS.find(d => d.value === department)?.label || "________")}</span> department at FUNT Robotics Academy as a{" "}
                    <span className="font-semibold">{employmentType === "OTHER" ? (customEmploymentType || "________") : (EMPLOYMENT_TYPES.find(e => e.value === employmentType)?.label || "________")}</span>.
                  </p>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                    <p><span className="font-bold">Position:</span> {designation || "—"}</p>
                    <p><span className="font-bold">Department:</span> {department === "OTHER" ? (customDepartment || "—") : (DEPARTMENTS.find(d => d.value === department)?.label || "—")}</p>
                    <p><span className="font-bold">Employment Type:</span> {employmentType === "OTHER" ? (customEmploymentType || "—") : (EMPLOYMENT_TYPES.find(e => e.value === employmentType)?.label || "—")}</p>
                    <p><span className="font-bold">Date of Joining:</span> {joiningDate ? new Date(joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</p>
                    <p><span className="font-bold">Location:</span> {location || "Remote"}</p>
                    {stipend && <p><span className="font-bold">Stipend:</span> {stipend}</p>}
                    {ctc && <p><span className="font-bold">CTC:</span> {ctc}</p>}
                    {reportingTo && <p><span className="font-bold">Reporting To:</span> {reportingTo}</p>}
                  </div>

                  <p>We are confident that your skills and experience will be a great asset to our team. Please confirm your acceptance of this offer by signing and returning a copy of this letter.</p>
                  <p>We look forward to welcoming you aboard.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-bold">To Whom It May Concern</p>
                  <p>
                    This is to certify that <span className="font-semibold">{recipientName || "________"}</span> was associated with FUNT Robotics Academy as a{" "}
                    <span className="font-semibold">{employmentType === "OTHER" ? (customEmploymentType || "________") : (EMPLOYMENT_TYPES.find(e => e.value === employmentType)?.label || "________")}</span> in the{" "}
                    <span className="font-semibold">{department === "OTHER" ? (customDepartment || "________") : (DEPARTMENTS.find(d => d.value === department)?.label || "________")}</span> department
                    {joiningDate ? ` from ${new Date(joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}` : ""}
                    {endDate ? ` to ${new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}` : ""}.
                  </p>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                    <p><span className="font-bold">Name:</span> {recipientName || "—"}</p>
                    <p><span className="font-bold">Designation:</span> {designation || "—"}</p>
                    <p><span className="font-bold">Department:</span> {department === "OTHER" ? (customDepartment || "—") : (DEPARTMENTS.find(d => d.value === department)?.label || "—")}</p>
                    <p><span className="font-bold">Employment Type:</span> {employmentType === "OTHER" ? (customEmploymentType || "—") : (EMPLOYMENT_TYPES.find(e => e.value === employmentType)?.label || "—")}</p>
                    <p><span className="font-bold">Period:</span> {joiningDate ? new Date(joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"} to {endDate ? new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</p>
                  </div>

                  {performanceSummary && (
                    <div>
                      <p className="font-bold">Performance Summary:</p>
                      <p>{performanceSummary}</p>
                    </div>
                  )}

                  <p>During the tenure, {recipientName || "the employee"} demonstrated professionalism and dedication. We wish all the best for future endeavors.</p>
                </div>
              )}

              {/* Signature */}
              <div className="mt-8 space-y-1">
                <p className="font-bold">For FUNT Robotics Academy</p>
                <div className="mt-6 w-40 border-t border-slate-400" />
                <p className="text-xs text-slate-500">Authorized Signatory</p>
              </div>

              {/* Footer */}
              <div className="mt-8 border-t border-slate-200 pt-3 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[8px] text-slate-400">QR Code</div>
                <div className="text-[10px] text-slate-400 space-y-0.5">
                  <p>Verify: https://api.funt.in/verify/letter/LTR-XXXXXX</p>
                  <p>Letter ID: LTR-XXXXXX</p>
                  <p className="font-medium text-slate-500">This document is digitally signed by FUNT Robotics Academy.</p>
                  <p>Signature can be verified at the URL above or by scanning the QR code.</p>
                  <p>This is a system-generated document and does not require a physical signature.</p>
                </div>
              </div>
            </div>
          </div>
        </DataPanel>
      )}

      <PageSection>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or ID" className="input text-sm w-64" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input text-sm">
            <option value="">All types</option>
            {LETTER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input text-sm">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="PENDING_ACCEPTANCE">Pending Acceptance</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED_BY_INTERN">Rejected by Intern</option>
            <option value="EXPIRED">Expired</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="ACTIVE">Active</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
      </PageSection>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center"><div className="spinner" /></div>
      ) : (
        <DataPanel className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Letter ID</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Recipient</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Designation</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Department</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Issued</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {letters.map((l) => (
                <tr key={l.letterId} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{l.letterId}</td>
                  <td className="px-4 py-3 text-slate-600">{l.type === "OFFER_LETTER" ? "Offer" : "Experience"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{l.recipientName}</td>
                  <td className="px-4 py-3 text-slate-600">{l.designation}</td>
                  <td className="px-4 py-3 text-slate-600">{l.department}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      l.status === "ACCEPTED" || l.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      l.status === "PENDING_ACCEPTANCE" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      l.status === "DRAFT" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                      l.status === "PENDING_APPROVAL" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                      l.status === "REJECTED_BY_INTERN" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                      l.status === "EXPIRED" ? "bg-slate-100 text-slate-500 border border-slate-200" :
                      l.status === "WITHDRAWN" ? "bg-orange-50 text-orange-700 border border-orange-200" :
                      "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {l.status === "PENDING_ACCEPTANCE" ? "Awaiting Intern" :
                       l.status === "PENDING_APPROVAL" ? "Awaiting Approval" :
                       l.status === "REJECTED_BY_INTERN" ? "Intern Declined" :
                       l.status === "DRAFT" ? "Draft" :
                       l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{l.issuedAt ? new Date(l.issuedAt).toLocaleDateString() : l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {l.letterId && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472"}/api/letters/${l.letterId}/pdf`, { credentials: "include" });
                              if (!res.ok) return;
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${l.letterId}.pdf`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch { /* ignore */ }
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          PDF
                        </button>
                      )}
                      {l.status === "DRAFT" && (
                        <button type="button" onClick={async () => {
                          const res = await api(`/api/letters/${l._id || l.letterId}/submit-approval`, { method: "POST" });
                          if (res.success) loadLetters();
                        }} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                          Submit for Approval
                        </button>
                      )}
                      {l.status === "PENDING_APPROVAL" && (
                        <>
                          <button type="button" onClick={async () => {
                            const res = await api(`/api/letters/${l._id || l.letterId}/approve`, { method: "POST" });
                            if (res.success) loadLetters();
                          }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                            Approve
                          </button>
                          <button type="button" onClick={async () => {
                            const reason = prompt("Reason for rejection:");
                            if (!reason?.trim()) return;
                            const res = await api(`/api/letters/${l._id || l.letterId}/reject-approval`, { method: "POST", body: JSON.stringify({ reason }) });
                            if (res.success) loadLetters();
                          }} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                            Reject
                          </button>
                        </>
                      )}
                      {l.status === "PENDING_ACCEPTANCE" && (
                        <>
                          <button type="button" onClick={() => handleAccept(l.letterId)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                            Intern Accepted
                          </button>
                          <button type="button" onClick={async () => {
                            const reason = prompt("Reason intern declined (optional):");
                            const res = await api(`/api/letters/${l.letterId}/intern-reject`, { method: "PATCH", body: JSON.stringify({ reason: reason || "" }) });
                            if (res.success) loadLetters();
                          }} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100">
                            Intern Declined
                          </button>
                          <button type="button" onClick={() => handleWithdraw(l.letterId)} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100">
                            Withdraw
                          </button>
                        </>
                      )}
                      {l.status === "ACCEPTED" && l.type === "OFFER_LETTER" && (
                        <button type="button" onClick={async () => {
                          const duties = prompt("Duties performed during internship:");
                          if (!duties?.trim()) return;
                          const endDt = prompt("End date (YYYY-MM-DD):");
                          if (!endDt?.trim()) return;
                          const res = await api(`/api/letters/${l.letterId}/experience`, {
                            method: "POST",
                            body: JSON.stringify({ endDate: endDt, dutiesDescription: duties, signatoryName: signatoryName || undefined, signatoryRole: signatoryRole || undefined }),
                          });
                          if (res.success) { loadLetters(); alert("Experience letter created!"); }
                          else alert(res.message ?? "Failed");
                        }} className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100">
                          Issue Experience
                        </button>
                      )}
                      {(l.status === "ACCEPTED" || l.status === "ACTIVE") && (
                        <button type="button" onClick={() => setRevokeId(l.letterId)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {letters.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No letters found.</td></tr>
              )}
            </tbody>
          </table>
        </DataPanel>
      )}

      {/* Revoke Modal */}
      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Revoke Letter</h3>
            <p className="mt-1 text-sm text-slate-500">Letter ID: {revokeId}</p>
            <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} rows={3} placeholder="Reason for revoking..." className="input mt-3 w-full text-sm" />
            <div className="mt-4 flex gap-2">
              <button onClick={handleRevoke} disabled={!revokeReason.trim()} className="btn-primary px-4 py-2 text-sm bg-red-600 hover:bg-red-500">Revoke</button>
              <button onClick={() => { setRevokeId(""); setRevokeReason(""); }} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
