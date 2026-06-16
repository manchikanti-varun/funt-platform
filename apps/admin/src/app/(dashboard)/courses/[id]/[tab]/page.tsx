import { redirect } from "next/navigation";
import ViewCoursePage from "../view/page";

interface CourseTabPageProps {
  params: Promise<{ id: string; tab: string }>;
}

export default async function CourseTabPage({ params }: CourseTabPageProps) {
  const { id, tab } = await params;
  if (tab === "view") {
    return <ViewCoursePage />;
  }
  // Don't intercept known subroutes — let Next.js resolve them
  redirect(`/courses/${id}/view`);
}
