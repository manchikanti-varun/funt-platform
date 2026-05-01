import { redirect } from "next/navigation";
import ViewBatchPage from "../view/page";

interface BatchTabPageProps {
  params: { id: string; tab: string };
}

export default function BatchTabPage({ params }: BatchTabPageProps) {
  const { id, tab } = params;
  if (tab !== "view") {
    redirect(`/batches/${id}/view`);
  }
  return <ViewBatchPage />;
}
