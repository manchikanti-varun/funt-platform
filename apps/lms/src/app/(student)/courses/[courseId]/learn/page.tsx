"use client";

import { Suspense } from "react";
import { CourseViewerPage } from "../page";

export default function CourseLearnPage() {
  return (
    <Suspense fallback={<div className="flex h-full min-h-0 flex-1 items-center justify-center"><div className="spinner" /></div>}>
      <CourseViewerPage defaultShowChapters />
    </Suspense>
  );
}
