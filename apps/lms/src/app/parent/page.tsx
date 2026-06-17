"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

function ParentRootRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/parent/profiles");
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="spinner" />
    </div>
  );
}

export default function ParentDashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><div className="spinner" /></div>}>
      <ParentRootRedirect />
    </Suspense>
  );
}
