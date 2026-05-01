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
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" />
    </div>
  );
}

export default function ParentDashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-funt-gold" /></div>}>
      <ParentRootRedirect />
    </Suspense>
  );
}
