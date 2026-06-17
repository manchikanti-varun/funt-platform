import Link from "next/link";
import { AppPageShell } from "@/components/ui";
import { CourseLicenseKeyGenerator } from "@/components/CourseLicenseKeyGenerator";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function LicenseKeysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const batchId = typeof params.batchId === "string" ? params.batchId.trim() : undefined;
  const courseId = typeof params.courseId === "string" ? params.courseId.trim() : undefined;

  if (!batchId) {
    return (
      <AppPageShell>
        <PageHeader
          title="License keys"
          subtitle="Keys belong to a batch (cohort). Open a batch from the list, then generate keys for a course in that cohort."
        />
        <Link href="/batches" className="btn-primary inline-flex w-fit text-sm font-semibold">
          Go to batches
        </Link>
        <p className="text-sm text-slate-500">
          <Link href="/payments" className="font-medium text-teal-700 hover:text-teal-800">
            Payment verifications
          </Link>
          <span className="text-slate-400"> · </span>
          <Link href="/license-key-audit" className="font-medium text-teal-700 hover:text-teal-800">
            License key audit
          </Link>
        </p>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <PageHeader
        title="License keys"
        subtitle="This cohort only. One key enrolls one student into this batch."
      />
      <div className="card overflow-hidden p-0">
        <CourseLicenseKeyGenerator showFlowHelp lockedBatchId={batchId} lockedCourseId={courseId} />
      </div>
      <p className="text-sm text-slate-500">
        <Link href="/payments" className="font-medium text-teal-700 hover:text-teal-800">
          Payment verifications
        </Link>
        <span className="text-slate-400"> · </span>
        <Link href={`/batches/${batchId}/student-access`} className="font-medium text-teal-700 hover:text-teal-800">
          Student access
        </Link>
        <span className="text-slate-400"> · </span>
        <Link href={`/batches/${batchId}/view`} className="font-medium text-slate-600 hover:text-slate-800">
          Batch overview
        </Link>
      </p>
    </AppPageShell>
  );
}
