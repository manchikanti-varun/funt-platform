"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BackLink } from "@/components/ui/BackLink";

const ACTION_CARD_CLASS =
  "block w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-teal-200 hover:shadow-md";

export default function BatchSettingsHubPage() {
  const params = useParams();
  const id = params.id as string;
  const [batchName, setBatchName] = useState("");

  useEffect(() => {
    if (!id) return;
    api<{ name: string }>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) setBatchName(r.data.name);
    });
  }, [id]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4">
        <BackLink href={`/batches/${id}/view`}>Back to batch</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Batch settings</h1>
          <p className="mt-1 text-sm text-slate-600">{batchName}</p>
          <p className="mt-2 text-sm text-slate-500">Choose an action below.</p>
        </div>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href={`/batches/${id}/student-access`} className={ACTION_CARD_CLASS}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <h2 className="mt-3 font-semibold text-slate-900">Student access</h2>
              <p className="mt-1 text-sm text-slate-500">Add or remove students who can access this batch.</p>
            </Link>
            <Link href={`/batches/${id}/enrollment-requests`} className={ACTION_CARD_CLASS}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </span>
              <h2 className="mt-3 font-semibold text-slate-900">Enrollment requests</h2>
              <p className="mt-1 text-sm text-slate-500">Approve or reject pending enrollment requests.</p>
            </Link>
            <Link href={`/batches/${id}/moderators`} className={ACTION_CARD_CLASS}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <h2 className="mt-3 font-semibold text-slate-900">Moderators</h2>
              <p className="mt-1 text-sm text-slate-500">Manage admins or trainers who can edit this batch.</p>
            </Link>
            <Link href={`/batches/${id}/submissions`} className={ACTION_CARD_CLASS}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h2 className="mt-3 font-semibold text-slate-900">Assignment submissions</h2>
              <p className="mt-1 text-sm text-slate-500">Review and approve module assignment submissions.</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
