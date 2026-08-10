"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { X, Save, RotateCcw } from "lucide-react";

interface LetterDetail {
  _id: string;
  letterId?: string;
  type: string;
  recipientName: string;
  recipientEmail?: string;
  recipientGender?: string;
  employmentType: string;
  department: string;
  designation: string;
  joiningDate: string;
  endDate?: string;
  duration?: string;
  stipend?: string;
  ctc?: string;
  location?: string;
  reportingTo?: string;
  responsibilities?: string;
  timings?: string;
  termsAndConditions?: string;
  status: string;
}

interface Props {
  letterId: string;
  onSaved: () => void;
  onClose: () => void;
}

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

export function LetterEditModal({ letterId, onSaved, onClose }: Props) {
  const [letter, setLetter] = useState<LetterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("Mr");
  const [empType, setEmpType] = useState("INTERN");
  const [dept, setDept] = useState("ENGINEERING");
  const [desg, setDesg] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState("");
  const [stipend, setStipend] = useState("");
  const [ctc, setCtc] = useState("");
  const [loc, setLoc] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [resp, setResp] = useState("");
  const [timings, setTimings] = useState("");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    api<LetterDetail>(`/api/letters/${letterId}`)
      .then((r) => {
        if (r.success && r.data) {
          const d = r.data;
          setLetter(d);
          setName(d.recipientName || "");
          setEmail(d.recipientEmail || "");
          setGender(d.recipientGender || "Mr");
          setEmpType(d.employmentType || "INTERN");
          setDept(d.department || "ENGINEERING");
          setDesg(d.designation || "");
          setJoinDate(d.joiningDate ? d.joiningDate.split("T")[0] : "");
          setEndDate(d.endDate ? d.endDate.split("T")[0] : "");
          setDuration(d.duration || "");
          setStipend(d.stipend || "");
          setCtc(d.ctc || "");
          setLoc(d.location || "");
          setReportTo(d.reportingTo || "");
          setResp(d.responsibilities || "");
          setTimings(d.timings || "");
          setTerms(d.termsAndConditions || "");
        } else {
          setError(r.message ?? "Failed to load letter.");
        }
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [letterId]);

  async function handleSave() {
    if (!name.trim() || !desg.trim()) {
      setError("Name and designation are required.");
      return;
    }
    setSaving(true);
    setError("");
    setMsg("");

    const body: Record<string, unknown> = {
      recipientName: name.trim(),
      recipientEmail: email.trim() || undefined,
      recipientGender: gender,
      employmentType: empType,
      department: dept,
      designation: desg.trim(),
      joiningDate: joinDate || undefined,
      endDate: endDate || undefined,
      duration: duration.trim() || undefined,
      stipend: stipend.trim() || undefined,
      ctc: ctc.trim() || undefined,
      location: loc.trim() || undefined,
      reportingTo: reportTo.trim() || undefined,
      responsibilities: resp.trim() || undefined,
      timings: timings.trim() || undefined,
      termsAndConditions: terms.trim() || undefined,
    };

    const r = await api(`/api/letters/${letterId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (r.success) {
      setMsg("Letter updated successfully!");
      onSaved();
      setTimeout(() => onClose(), 1000);
    } else {
      setError(r.message ?? "Failed to update letter.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Letter</h2>
            <p className="text-xs text-slate-500">
              {letter?.letterId || "Draft"} · {letter?.status?.replace(/_/g, " ")}
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && <div className="flex items-center justify-center py-12"><div className="spinner" /></div>}

          {!loading && error && !letter && <div className="alert alert--error">{error}</div>}

          {letter && !loading && (
            <div className="space-y-5">
              {/* Recipient */}
              <fieldset className="space-y-3">
                <legend className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Recipient</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Full Name *</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Title</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="input mt-1">
                      <option>Mr</option><option>Ms</option><option>Mrs</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Position */}
              <fieldset className="space-y-3">
                <legend className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Position</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Designation *</label>
                    <input value={desg} onChange={(e) => setDesg(e.target.value)} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Department</label>
                    <select value={dept} onChange={(e) => setDept(e.target.value)} className="input mt-1">
                      {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Employment Type</label>
                    <select value={empType} onChange={(e) => setEmpType(e.target.value)} className="input mt-1">
                      {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Duration */}
              <fieldset className="space-y-3">
                <legend className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Duration</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Joining Date</label>
                    <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">End Date</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Duration</label>
                    <input value={duration} onChange={(e) => setDuration(e.target.value)} className="input mt-1" placeholder="e.g. 3 Months" />
                  </div>
                </div>
              </fieldset>

              {/* Compensation & Details */}
              <fieldset className="space-y-3">
                <legend className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Compensation & Details</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Stipend</label>
                    <input value={stipend} onChange={(e) => setStipend(e.target.value)} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">CTC</label>
                    <input value={ctc} onChange={(e) => setCtc(e.target.value)} className="input mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Location</label>
                    <input value={loc} onChange={(e) => setLoc(e.target.value)} className="input mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Reporting To</label>
                  <input value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Responsibilities</label>
                  <textarea value={resp} onChange={(e) => setResp(e.target.value)} rows={4} className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Timings</label>
                  <input value={timings} onChange={(e) => setTimings(e.target.value)} className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Terms & Conditions</label>
                  <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={5} className="input mt-1" />
                </div>
              </fieldset>

              {/* Messages */}
              {error && <div className="alert alert--error text-sm">{error}</div>}
              {msg && <div className="alert alert--success text-sm">{msg}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        {letter && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
              {saving ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
