"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import {
  X, FileText, Award, Download, User, Briefcase, MapPin,
  Calendar, DollarSign, Clock, ShieldCheck, UserCheck, Edit3,
  Link2, Upload, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";

interface UploadedDoc {
  docType: string;
  filename: string;
  fileKey: string;
  fileSize?: number;
  uploadedAt?: string;
}

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
  acceptanceDeadline?: string;
  acceptanceToken?: string;
  revokedAt?: string;
  revokedReason?: string;
  digitalSignatureName?: string;
  uploadedDocuments?: UploadedDoc[];
  documentReviewStatus?: string;
  documentReviewNote?: string;
}

interface Props {
  letterId: string;
  onClose: () => void;
  onDownloadPdf: (id: string) => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  PHOTO: "Passport Photo",
  AADHAAR: "Aadhaar / Voter ID / DL",
  PAN_BANK: "PAN + Bank Details",
  EDUCATION: "Educational Certificates",
  OFFER_COPY: "Signed Offer Copy",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472";

export function LetterPreviewPanel({ letterId, onClose, onDownloadPdf }: Props) {
  const [letter, setLetter] = useState<LetterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");

  function loadLetter() {
    api<LetterDetail>(`/api/letters/${letterId}`)
      .then((r) => {
        if (r.success && r.data) setLetter(r.data);
        else setError(r.message ?? "Failed to load letter details.");
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadLetter(); }, [letterId]);

  async function handleReview(status: "APPROVED" | "REJECTED") {
    if (!letter) return;
    setReviewing(true);
    setReviewMsg("");
    const r = await api(`/api/letters/${letter._id || letter.letterId}/review-documents`, {
      method: "PATCH",
      body: JSON.stringify({ status, note: reviewNote.trim() }),
    });
    setReviewing(false);
    if (r.success) {
      setReviewMsg(`Documents ${status.toLowerCase()}.`);
      loadLetter();
    } else {
      setReviewMsg(r.message ?? "Failed to review.");
    }
  }

  const acceptancePortalUrl = letter?.acceptanceToken
    ? `${(process.env.NEXT_PUBLIC_MARKETING_URL || "https://funt.in").replace(/\/+$/, "")}/accept-offer?token=${letter.acceptanceToken}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${letter?.type === "EXPERIENCE_LETTER" ? "bg-purple-100 text-purple-600" : "bg-indigo-100 text-indigo-600"}`}>
              {letter?.type === "EXPERIENCE_LETTER" ? <Award className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="spinner" />
            </div>
          )}

          {error && <div className="alert alert--error">{error}</div>}

          {letter && !loading && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <StatusBadge status={letter.status} />
                {letter.approvalStatus && letter.approvalStatus !== letter.status && (
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    Approval: {letter.approvalStatus.replace(/_/g, " ")}
                  </span>
                )}
                {letter.digitalSignatureName && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    Signed: {letter.digitalSignatureName}
                  </span>
                )}
              </div>

              {/* Acceptance Portal Link */}
              {acceptancePortalUrl && letter.status === "PENDING_ACCEPTANCE" && (
                <Section icon={<Link2 className="h-4 w-4" />} title="Acceptance Portal">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Send this link to the intern to accept the offer online:</p>
                    <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                      <input
                        readOnly
                        value={acceptancePortalUrl}
                        className="flex-1 bg-transparent text-xs font-mono text-indigo-700 outline-none"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={() => { navigator.clipboard.writeText(acceptancePortalUrl); }}
                        className="shrink-0 rounded-md bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-200"
                      >
                        Copy
                      </button>
                      <a href={acceptancePortalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-indigo-500 hover:text-indigo-700">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    {letter.acceptanceDeadline && (
                      <p className="text-[11px] text-slate-400">Expires: {formatDate(letter.acceptanceDeadline)}</p>
                    )}
                  </div>
                </Section>
              )}

              {/* Uploaded Documents */}
              {letter.uploadedDocuments && letter.uploadedDocuments.length > 0 && (
                <Section icon={<Upload className="h-4 w-4" />} title="Uploaded Documents">
                  <div className="space-y-2">
                    {letter.uploadedDocuments.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700">{DOC_TYPE_LABELS[doc.docType] || doc.docType}</p>
                          <p className="truncate text-[11px] text-slate-500">{doc.filename}</p>
                        </div>
                        {doc.fileKey && (
                          <a
                            href={`${API_URL}/api/student/files/download?key=${encodeURIComponent(doc.fileKey)}&name=${encodeURIComponent(doc.filename)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            View
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Document Review Status */}
                  {letter.documentReviewStatus && (
                    <div className={`mt-3 rounded-lg border px-3 py-2 ${
                      letter.documentReviewStatus === "APPROVED" ? "border-emerald-200 bg-emerald-50" :
                      letter.documentReviewStatus === "REJECTED" ? "border-red-200 bg-red-50" :
                      "border-amber-200 bg-amber-50"
                    }`}>
                      <p className={`text-xs font-semibold ${
                        letter.documentReviewStatus === "APPROVED" ? "text-emerald-700" :
                        letter.documentReviewStatus === "REJECTED" ? "text-red-700" :
                        "text-amber-700"
                      }`}>
                        Documents: {letter.documentReviewStatus.replace(/_/g, " ")}
                      </p>
                      {letter.documentReviewNote && (
                        <p className="mt-1 text-[11px] text-slate-600">{letter.documentReviewNote}</p>
                      )}
                    </div>
                  )}

                  {/* Review Actions */}
                  {letter.documentReviewStatus === "PENDING_REVIEW" && (
                    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-700">Review Documents</p>
                      <input
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Note (optional)"
                        className="input w-full text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview("APPROVED")}
                          disabled={reviewing}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReview("REJECTED")}
                          disabled={reviewing}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                      {reviewMsg && <p className="text-xs text-slate-600">{reviewMsg}</p>}
                    </div>
                  )}
                </Section>
              )}

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
                <InfoRow label="Type" value={letter.employmentType.replace(/_/g, " ")} />
                {letter.reportingTo && <InfoRow label="Reporting To" value={letter.reportingTo} />}
              </Section>

              {/* Responsibilities */}
              {letter.responsibilities && (
                <Section icon={<Edit3 className="h-4 w-4" />} title="Responsibilities">
                  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{letter.responsibilities}</p>
                </Section>
              )}

              {/* Timings */}
              {letter.timings && (
                <Section icon={<Clock className="h-4 w-4" />} title="Timings">
                  <p className="text-sm text-slate-700">{letter.timings}</p>
                </Section>
              )}

              {/* Terms & Conditions */}
              {letter.termsAndConditions && (
                <Section icon={<ShieldCheck className="h-4 w-4" />} title="Terms & Conditions">
                  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{letter.termsAndConditions}</p>
                </Section>
              )}

              {/* Duration */}
              <Section icon={<Calendar className="h-4 w-4" />} title="Duration">
                <InfoRow label="Joining" value={formatDate(letter.joiningDate)} />
                {letter.endDate && <InfoRow label="End Date" value={formatDate(letter.endDate)} />}
                {letter.duration && <InfoRow label="Period" value={letter.duration} />}
              </Section>

              {/* Compensation */}
              {(letter.stipend || letter.ctc || letter.location) && (
                <Section icon={<DollarSign className="h-4 w-4" />} title="Compensation & Location">
                  {letter.stipend && <InfoRow label="Stipend" value={`₹${letter.stipend} /month`} />}
                  {letter.ctc && <InfoRow label="CTC" value={`₹${letter.ctc} /year`} />}
                  {letter.location && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{letter.location}</span>
                    </div>
                  )}
                </Section>
              )}

              {/* Experience-specific */}
              {letter.type === "EXPERIENCE_LETTER" && (
                <Section icon={<Award className="h-4 w-4" />} title="Experience Details">
                  {letter.dutiesDescription && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500">Duties</p>
                      <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{letter.dutiesDescription}</p>
                    </div>
                  )}
                  {letter.performanceSummary && (
                    <div className="space-y-1 pt-2">
                      <p className="text-xs font-medium text-slate-500">Performance</p>
                      <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{letter.performanceSummary}</p>
                    </div>
                  )}
                  {letter.linkedLetterId && <InfoRow label="Linked Offer" value={letter.linkedLetterId} />}
                </Section>
              )}

              {/* Signatory */}
              {(letter.signatoryName || letter.signatoryRole) && (
                <Section icon={<UserCheck className="h-4 w-4" />} title="Signatory">
                  {letter.signatoryName && <InfoRow label="Name" value={letter.signatoryName} />}
                  {letter.signatoryRole && <InfoRow label="Role" value={letter.signatoryRole} />}
                </Section>
              )}

              {/* Timeline */}
              <Section icon={<Clock className="h-4 w-4" />} title="Timeline">
                {letter.createdAt && <InfoRow label="Created" value={formatDate(letter.createdAt)} />}
                {letter.issuedAt && <InfoRow label="Issued" value={formatDate(letter.issuedAt)} />}
                {letter.acceptedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                      <UserCheck className="h-3 w-3 text-emerald-600" />
                    </span>
                    <span className="text-slate-700">Accepted on {formatDate(letter.acceptedAt)}</span>
                  </div>
                )}
                {letter.revokedAt && (
                  <div className="space-y-1 rounded-lg border border-red-100 bg-red-50 p-3">
                    <p className="text-xs font-semibold text-red-700">Revoked on {formatDate(letter.revokedAt)}</p>
                    {letter.revokedReason && (
                      <p className="text-xs text-red-600">Reason: {letter.revokedReason}</p>
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
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
        <span className="text-slate-500">{icon}</span>
        {title}
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
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
