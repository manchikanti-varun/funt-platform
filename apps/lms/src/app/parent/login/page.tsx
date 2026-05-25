"use client";

import { ParentLinkedStudentsPicker } from "../_components/ParentLinkedStudentsPicker";

export default function ParentLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background: "radial-gradient(520px 280px at 50% -8%, rgba(165, 180, 252, 0.35), transparent 70%)",
        }}
      />
      <div className="relative w-full">
        <ParentLinkedStudentsPicker
          title="Parent login"
          heading="Sign in to monitor your child"
          subtitle="Enter your phone number to see your linked student profiles."
        />
      </div>
    </div>
  );
}
