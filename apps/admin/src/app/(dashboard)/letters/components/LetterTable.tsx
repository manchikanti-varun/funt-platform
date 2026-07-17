"use client";

import {
  Download, Send, ShieldCheck, XCircle, UserCheck, UserX,
  Ban, CalendarPlus, Award, FileText,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { LetterRow } from "../types";

interface Props {
  letters: LetterRow[];
  onAction: (id: string, action: string, body?: Record<string, unknown>) => Promise<void>;
  onDownloadPdf: (id: string) => void;
  onRevoke: (id: string) => void;
  onExtend: (id: string) => void;
  onExperience: (id: string) => void;
}

export function LetterTable({ letters, onAction, onDownloadPdf, onRevoke, onExtend, onExperience }: Props) {
  return (
    <div className="panel-data overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="th-compact">Letter ID</th>
            <th className="th-compact">Type</th>
            <th className="th-compact">Recipient</th>
            <th className="th-compact">Designation</th>
            <th className="th-compact">Department</th>
            <th className="th-compact">Status</th>
            <th className="th-compact">Issued</th>
            <th className="th-compact text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {letters.map((l) => (
            <tr key={l._id || l.letterId} className="transition hover:bg-indigo-50/30">
              <td className="px-4 py-3">
                <span className="font-mono text-xs font-semibold text-indigo-600">
                  {l.letterId || <span className="italic text-slate-400">draft</span>}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${l.type === "OFFER_LETTER" ? "text-indigo-600" : "text-purple-600"}`}>
                  {l.type === "OFFER_LETTER" ? <FileText className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />}
                  {l.type === "OFFER_LETTER" ? "Offer" : "Experience"}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">{l.recipientName}</td>
              <td className="px-4 py-3 text-xs text-slate-600">{l.designation}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{l.department}</td>
              <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {(l.issuedAt || l.createdAt)
                  ? new Date(l.issuedAt || l.createdAt!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {/* Download PDF */}
                  {l.letterId && (
                    <ActionBtn onClick={() => onDownloadPdf(l.letterId)} title="Download PDF" cls="border-slate-200 text-slate-500 hover:bg-slate-100">
                      <Download className="h-3.5 w-3.5" />
                    </ActionBtn>
                  )}

                  {/* Draft → Submit for Approval */}
                  {l.status === "DRAFT" && (
                    <ActionBtn onClick={() => onAction(l._id || l.letterId, "submit-approval")} title="Submit for Approval" cls="border-blue-200 text-blue-600 hover:bg-blue-50">
                      <Send className="h-3.5 w-3.5" />
                    </ActionBtn>
                  )}

                  {/* Pending Approval → Approve / Reject */}
                  {l.status === "PENDING_APPROVAL" && (
                    <>
                      <ActionBtn onClick={() => onAction(l._id || l.letterId, "approve")} title="Approve" cls="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </ActionBtn>
                      <ActionBtn
                        onClick={() => {
                          const r = prompt("Rejection reason:");
                          if (r) onAction(l._id || l.letterId, "reject-approval", { reason: r });
                        }}
                        title="Reject"
                        cls="border-red-200 text-red-500 hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </ActionBtn>
                    </>
                  )}

                  {/* Pending Acceptance → Accept / Decline / Withdraw */}
                  {l.status === "PENDING_ACCEPTANCE" && (
                    <>
                      <ActionBtn onClick={() => onAction(l.letterId, "accept")} title="Mark Accepted" cls="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                        <UserCheck className="h-3.5 w-3.5" />
                      </ActionBtn>
                      <ActionBtn onClick={() => onAction(l.letterId, "intern-reject")} title="Mark Declined" cls="border-rose-200 text-rose-500 hover:bg-rose-50">
                        <UserX className="h-3.5 w-3.5" />
                      </ActionBtn>
                      <ActionBtn onClick={() => onAction(l.letterId, "withdraw")} title="Withdraw" cls="border-orange-200 text-orange-500 hover:bg-orange-50">
                        <Ban className="h-3.5 w-3.5" />
                      </ActionBtn>
                    </>
                  )}

                  {/* Accepted Offer → Experience / Extend */}
                  {l.status === "ACCEPTED" && l.type === "OFFER_LETTER" && (
                    <>
                      <ActionBtn onClick={() => onExperience(l.letterId)} title="Issue Experience Letter" cls="border-purple-200 text-purple-600 hover:bg-purple-50">
                        <Award className="h-3.5 w-3.5" />
                      </ActionBtn>
                      {l.employmentType === "INTERN" && (
                        <ActionBtn onClick={() => onExtend(l.letterId)} title="Extend Internship" cls="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                          <CalendarPlus className="h-3.5 w-3.5" />
                        </ActionBtn>
                      )}
                    </>
                  )}

                  {/* Revoke */}
                  {(l.status === "ACCEPTED" || l.status === "ACTIVE") && (
                    <ActionBtn onClick={() => onRevoke(l.letterId)} title="Revoke" cls="border-red-200 text-red-500 hover:bg-red-50">
                      <XCircle className="h-3.5 w-3.5" />
                    </ActionBtn>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionBtn({ onClick, title, cls, children }: {
  onClick: () => void;
  title: string;
  cls: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${cls}`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
