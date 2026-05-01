"use client";

import { ParentLinkedStudentsPicker } from "../_components/ParentLinkedStudentsPicker";

export default function ParentLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-[#fffdf7] via-[#fffaf0] to-[#fff7e6] p-4 overflow-y-auto">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          background: "radial-gradient(520px 280px at 50% -8%, rgba(212, 175, 55, 0.22), transparent 70%)",
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
