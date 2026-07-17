"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import {
  X, FileText, Award, Download, User, Briefcase, MapPin,
  Calendar, DollarSign, Clock, ShieldCheck, UserCheck,
} from "lucide-react";

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
  dutiesDescription?: string;
  performanceSummary?: string;
  status: string;
  approvalStatus?: string;
  signatoryName?: string;
  signatoryRole?: string;
  linkedLetterId?: string;
  issuedBy?: string;
  issuedAt?: string;
  createdAt?: string;
  acceptedAt?: string;
  revokedAt?: string;
  revokedReason?: string;
}

interface Props {
  letterId: string; // mongo _id or letterId
  onClose: () => void;
  onDownloadPdf: (id: string) => void;
}

export function LetterPreviewPanel({ letterId, onClose, onDownloadPdf }: Props) {
  const [letter, setLetter] = useState<LetterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<LetterDetail>(`/api/letters/${letterId}`)
      .then((r) => {
        if (r.success && r.data) setLetter(r.data);
        else setError(r.message ?? "Failed to load letter details.");
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, [letterId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${letter?.type === "EXPERIENCE_LETTER" ? "bg-purple-100 text-purple-600" : "bg-indigo-100 text-indigo-600"}`}>
              {letter?.type === "EXPERIENCE_LETTER" ? <Award className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {letter?.letterId || "Draft Letter"}
              </h2>
              <p className="text-xs text-slate-500">
                {letter?.type === "EXPERIENCE_LETTER" ? "Experience Letter" : "Offer Letter"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {letter?.letterId && (
              <button
                onClick={() => onDownloadPdf(letter.letterId!)}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="spinner" />
            </div>
          )}

          {error && (
            <div className="alert alert--error">{error}</div>
          )}

          {letter && !loading && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge status={letter.status} />
                {letter.approvalStatus && letter.approvalStatus !== letter.status && (
                  <span className="text-xs text-slate-400">
                    Approval: {letter.approvalStatus.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              {/* Recipient */}
              <Section icon={<User className="h-4 w-4" />} title="Recipient">
                <InfoRow label="Name" value={letter.recipientName} />
                {letter.recipientEmail && <InfoRow label="Email" value={letter.recipientEmail} />}
                {letter.recipientGender && <InfoRow label="Title" value={letter.recipientGender} />}
              </Section>

              {/* Position */}
              <Section icon={<Briefcase className="h-4 w-4" />} title="Position">
                <InfoRow label="Designation" value={letter.designation} />
                <InfoRow label="Department" value={letter.department} />
                <InfoRow label="Employment Type" value={letter.employmentType.replace(/_/g, " ")} />
                {letter.reportingTo && <InfoRow label="Reporting To" value={letter.reportingTo} />}
                {letter.responsibilities && <InfoRow label="Responsibilities" value={letter.responsibilities} />}
              </Section>

              {/* Duration */}
              <Section icon={<Calendar className="h-4 w-4" />} title="Duration">
                <InfoRow label="Joining Date" value={formatDate(letter.joiningDate)} />
                {letter.endDate && <InfoRow label="End Date" value={formatDate(letter.endDate)} />}
                {letter.duration && <InfoRow label="Duration" value={letter.duration} />}
              </Section>

              {/* Compensation */}
              {(letter.stipend || letter.ctc || letter.location) && (
                <Section icon={<DollarSign className="h-4 w-4" />} title="Compensation">
                  {letter.stipend && <InfoRow label="Stipend" value={letter.stipend} />}
                  {letter.ctc && <InfoRow label="CTC" value={letter.ctc} />}
                  {letter.location && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {letter.location}
                    </div>
                  )}
                </Section>
              )}

              {/* Experience-specific */}
              {letter.type === "EXPERIENCE_LETTER" && (
                <Section icon={<Award className="h-4 w-4" />} title="Experience Details">
                  {letter.dutiesDescription && <InfoRow label="Duties" value={letter.dutiesDescription} />}
                  {letter.performanceSummary && <InfoRow label="Performance" value={letter.performanceSummary} />}
                  {letter.linkedLetterId && <InfoRow label="Linked Offer" value={letter.linkedLetterId} />}
                </Section>
              )}

              {/* Signatory */}
              {(letter.signatoryName || letter.signatoryRole) && (
                <Section icon={<ShieldCheck className="h-4 w-4" />} title="Signatory">
                  {letter.signatoryName && <InfoRow label="Name" value={letter.signatoryName} />}
                  {letter.signatoryRole && <InfoRow label="Role" value={letter.signatoryRole} />}
                </Section>
              )}

              {/* Timeline */}
              <Section icon={<Clock className="h-4 w-4" />} title="Timeline">
                {letter.createdAt && <InfoRow label="Created" value={formatDate(letter.createdAt)} />}
                {letter.issuedAt && <InfoRow label="Issued" value={formatDate(letter.issuedAt)} />}
                {letter.acceptedAt && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <UserCheck className="h-3 w-3 text-emerald-500" />
                    <span className="text-slate-600">Accepted on {formatDate(letter.acceptedAt)}</span>
                  </div>
                )}
                {letter.revokedAt && (
                  <div className="space-y-1">
                    <InfoRow label="Revoked" value={formatDate(letter.revokedAt)} />
                    {letter.revokedReason && (
                      <p className="ml-[70px] text-xs text-red-600">Reason: {letter.revokedReason}</p>
                    )}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
        {icon}
        {title}
      </div>
      <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-[66px] shrink-0 font-medium text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
