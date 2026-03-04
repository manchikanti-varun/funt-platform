"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function GlobalAssignmentSettingsRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (id) router.replace(`/global-assignments/${id}/student-access`);
  }, [id, router]);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-sm text-slate-500">Redirecting to Student access…</p>
    </div>
  );
}
