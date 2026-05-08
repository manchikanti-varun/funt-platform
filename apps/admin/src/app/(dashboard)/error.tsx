"use client";

import { useEffect } from "react";
import { StateScreen } from "@/components/ui/StateScreen";

export default function DashboardErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StateScreen
      tone="error"
      title="Something went wrong"
      description="We hit a temporary issue while opening this page. Please try again."
      actionLabel="Try again"
      onAction={reset}
    />
  );
}
