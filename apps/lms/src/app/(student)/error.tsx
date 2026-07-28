"use client";

import { useEffect } from "react";
import { StateScreen } from "@/components/ui/StateScreen";

export default function StudentErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[StudentErrorBoundary]", error?.message, error?.stack);
  }, [error]);

  return (
    <div>
      <StateScreen
        tone="error"
        title="Oops, that page slipped away"
        description={error?.message || "A temporary issue interrupted this screen. Please try again."}
        actionLabel="Try again"
        onAction={reset}
      />
    </div>
  );
}
