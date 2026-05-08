import { StateScreen } from "@/components/ui/StateScreen";

export default function StudentLoadingPage() {
  return (
    <StateScreen
      tone="loading"
      title="Preparing your learning space"
      description="Syncing your progress, courses, and achievements..."
    />
  );
}
