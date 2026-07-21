"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { DataPanel } from "@/components/ui";
import {
  FileText, Send, RotateCcw, CheckCircle2, XCircle, Download, X,
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

interface Props {
  onCreated: () => void;
  onClose: () => void;
}

export function LetterCreateForm({ onCreated, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("Mr");
  const [empType, setEmpType] = useState("INTERN");
  const [dept, setDept] = useState("ENGINEERING");
  const [desg, setDesg] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dur, setDur] = useState("3");
  const [stipend, setStipend] = useState("");
  const [ctc, setCtc] = useState("");
  const [loc, setLoc] = useState("Hyderabad");
  const [reportTo, setReportTo] = useState("");
  const [resp, setResp] = useState("");
  const [timings, setTimings] = useState("");
  const [terms, setTerms] = useState("");
  const [sigName, setSigName] = useState("");
  const [sigRole, setSigRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function calcEnd(jd: string, months: string) {
    if (!jd) return;
    const d = new Date(jd);
    d.setMonth(d.getMonth() + parseInt(months));
    setEndDate(d.toISOString().split("T")[0]);
  }

  async function dlPdf(id: string) {
    const r = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472"}/api/letters/${id}/pdf`,
      { credentials: "include" }
    );
    if (!r.ok) return;
    const b = await r.blob();
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);

    if (!name.trim() || !desg.trim() || !joinDate) {
      setFormMsg({ type: "err", text: "Name, designation, and joining date are required." });
      return;
    }

    setSubmitting(true);
    const r = await api<{ letterId?: string; id?: string }>("/api/letters", {
      method: "POST",
      body: JSON.stringify({
        type: "OFFER_LETTER",
        recipientName: name.trim(),
        recipientEmail: email.trim() || undefined,
        recipientGender: gender,
        employmentType: empType,
        department: dept,
        designation: desg.trim(),
        joiningDate: joinDate,
        endDate: endDate || undefined,
        duration: empType === "INTERN" ? `${dur} Months` : undefined,
        stipend: stipend.trim() || undefined,
        ctc: ctc.trim() || undefined,
        location: loc.trim() || undefined,
        reportingTo: reportTo.trim() || undefined,
        responsibilities: resp.trim() || undefined,
        timings: timings.trim() || undefined,
        termsAndConditions: terms.trim() || undefined,
        signatoryName: sigName.trim() || undefined,
        signatoryRole: sigRole.trim() || undefined,
      }),
    });
    setSubmitting(false);

    if (r.success) {
      setFormMsg({ type: "ok", text: r.data?.letterId ?? "Letter created!" });
      setName("");
      setEmail("");
      setDesg("");
      setJoinDate("");
      setEndDate("");
      setStipend("");
      setCtc("");
      onCreated();
    } else {
      setFormMsg({ type: "err", text: r.message ?? "Failed to create letter." });
    }
  }

  return (
    <DataPanel className="overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 px-6 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            New Offer Letter
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Fill in the intern details. A PDF will be generated from your template settings.
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close form"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        {/* Intern Details */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">
            Intern Details
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Full Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" placeholder="Full name" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Title</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="input mt-1">
                <option>Mr</option>
                <option>Ms</option>
                <option>Mrs</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Position */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">
            Position
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Designation *</label>
              <input value={desg} onChange={(e) => setDesg(e.target.value)} className="input mt-1" placeholder="e.g. Robotics Trainer" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Department</label>
              <select value={dept} onChange={(e) => setDept(e.target.value)} className="input mt-1">
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Employment Type</label>
              <select value={empType} onChange={(e) => setEmpType(e.target.value)} className="input mt-1">
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Duration */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">
            Duration
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Joining Date *</label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => {
                  setJoinDate(e.target.value);
                  if (empType === "INTERN") calcEnd(e.target.value, dur);
                }}
                className="input mt-1"
              />
            </div>
            {empType === "INTERN" && (
              <div>
                <label className="text-xs font-medium text-slate-600">Duration (Months)</label>
                <select
                  value={dur}
                  onChange={(e) => { setDur(e.target.value); calcEnd(joinDate, e.target.value); }}
                  className="input mt-1"
                >
                  <option value="1">1 Month</option>
                  <option value="2">2 Months</option>
                  <option value="3">3 Months</option>
                  <option value="4">4 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                </select>
              </div>
            )}
            {empType === "INTERN" && (
              <div>
                <label className="text-xs font-medium text-slate-600">End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-1" />
              </div>
            )}
          </div>
        </fieldset>

        {/* Compensation & Reporting */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">
            Compensation & Reporting
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-600">
                {empType === "INTERN" ? "Stipend" : "CTC"}
              </label>
              {empType === "INTERN" ? (
                <input value={stipend} onChange={(e) => setStipend(e.target.value)} className="input mt-1" placeholder="6,000 (Six Thousand Only)" />
              ) : (
                <input value={ctc} onChange={(e) => setCtc(e.target.value)} className="input mt-1" placeholder="6,00,000/year" />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Location</label>
              <input value={loc} onChange={(e) => setLoc(e.target.value)} className="input mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Reporting To</label>
              <input value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="input mt-1" placeholder="Manager name" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Responsibilities</label>
            <textarea value={resp} onChange={(e) => setResp(e.target.value)} rows={6} className="input mt-1" placeholder="Training & Electronics tasks" />
            <p className="mt-1 text-xs text-slate-400">Use plain text. Paragraphs will be rendered in the PDF as-is.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Timings</label>
            <input value={timings} onChange={(e) => setTimings(e.target.value)} className="input mt-1" placeholder="e.g. 10:00 AM to 6:00 PM, Monday to Saturday" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Terms & Conditions</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={6} className="input mt-1" placeholder="Enter terms and conditions for the offer letter" />
            <p className="mt-1 text-xs text-slate-400">Use plain text. Paragraphs will be rendered in the PDF as-is.</p>
          </div>
        </fieldset>

        {/* Signatory */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">
            Signatory (optional overrides)
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Name</label>
              <input value={sigName} onChange={(e) => setSigName(e.target.value)} className="input mt-1" placeholder="Govind Raj" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Role</label>
              <input value={sigRole} onChange={(e) => setSigRole(e.target.value)} className="input mt-1" placeholder="Human Resources" />
            </div>
          </div>
        </fieldset>

        {/* Feedback & Submit */}
        {formMsg && (
          <div className={`alert ${formMsg.type === "ok" ? "alert--success" : "alert--error"}`}>
            {formMsg.type === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            <span>{formMsg.text}</span>
            {formMsg.type === "ok" && formMsg.text.startsWith("LTR") && (
              <button type="button" onClick={() => dlPdf(formMsg.text)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                <Download className="h-3.5 w-3.5" /> Download PDF
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm"
          >
            {submitting ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Generating..." : "Generate Letter"}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
        </div>
      </form>
    </DataPanel>
  );
}
