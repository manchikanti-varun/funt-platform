import { redirect } from "next/navigation";
import ViewCoursePage from "../view/page";

interface CourseTabPageProps {
  params: { id: string; tab: string };
}

export default function CourseTabPage({ params }: CourseTabPageProps) {
  const { id, tab } = params;
  if (tab !== "view") {
    redirect(`/courses/${id}/view`);
  }
  return <ViewCoursePage />;
}
