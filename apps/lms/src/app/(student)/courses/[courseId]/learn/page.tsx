"use client";

import { useRouter } from "next/navigation";

/**
 * /courses/[courseId]/learn — simply redirects to the main course page with learn=1.
 * The main page.tsx handles rendering with defaultShowChapters based on the learn query param.
 */
export default function CourseLearnPage() {
  const router = useRouter();
  // Preserve existing query params and add learn=1
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const courseId = url.pathname.replace(/\/learn\/?$/, "").split("/").pop() ?? "";
    const batchId = url.searchParams.get("batchId") ?? "";
    const target = `/courses/${courseId}${batchId ? `?batchId=${batchId}&learn=1` : "?learn=1"}`;
    router.replace(target);
  }
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center">
      <div className="spinner" />
    </div>
  );
}
