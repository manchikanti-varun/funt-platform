import { StateScreen } from "@/components/ui/StateScreen";

export default function DashboardLoadingPage() {
  return (
    <StateScreen
      tone="loading"
      title="Loading your workspace"
      description="Fetching latest data and preparing dashboards..."
    />
  );
}
