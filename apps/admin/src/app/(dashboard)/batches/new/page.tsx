"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAutoSavedForm } from "@/lib/useAutoSavedForm";

interface CourseOption {
  id: string;
  courseId?: string;
  title: string;
  description?: string;
  status: string;
  isDemo?: boolean;
  deliveryMode?: string;
  headerImageUrl?: string;
}

interface BadgeOption {
  badgeType: string;
  displayName: string;
  isActive?: boolean;
  awardMode?: "MANUAL" | "AUTO" | "BOTH";
}

import { BackLink } from "@/components/ui/BackLink";
import { DraftRestoredBanner } from "@/components/ui/DraftRestoredBanner";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { TrainerSelect } from "@/components/admin/StaffPickerFields";

/**
 * Auto-saved subset of the new-batch form. We deliberately exclude image
 * data URLs (fallback QR) because they can be up to ~1.5 MB
 * each and can easily push the whole draft past the localStorage quota.
 * Images are quick to re-attach; the painful loss is text + per-course
 * pricing/payment config, which is what we persist here.
 */
interface BatchDraft {
  name: string;
  trainerId: string;
  startDate: string;
  endDate: string;
  zoomLink: string;
  visibility: "PUBLIC" | "PRIVATE";
  selectedCourseIds: string[];
  enrollmentInrByCourseId: Record<string, string>;
  paymentByCourseId: Record<string, { upiManual: boolean; razorpay: boolean }>;
  completionCoinsByCourseId: Record<string, string>;
  completionBadgesByCourseId: Record<string, string[]>;
}

const INITIAL_DRAFT: BatchDraft = {
  name: "",
  trainerId: "",
  startDate: "",
  endDate: "",
  zoomLink: "",
  visibility: "PUBLIC",
  selectedCourseIds: [],
  enrollmentInrByCourseId: {},
  paymentByCourseId: {},
  completionCoinsByCourseId: {},
  completionBadgesByCourseId: {},
};
import {
  mapPaymentUpiApiToSummary,
  PlatformUpiCheckoutSummary,
  type PaymentUpiConfigApiResponse,
  type PlatformUpiSummaryState,
} from "@/components/admin/PlatformUpiCheckoutSummary";

const MAX_UPLOAD_IMAGE_BYTES = 1_500_000;

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose a PNG, JPEG, GIF, or WebP image."));
      return;
    }
    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      reject(new Error("Image must be under about 1.5 MB."));
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const s = typeof r.result === "string" ? r.result : "";
      if (!s.startsWith("data:image/")) reject(new Error("Could not read image."));
      else resolve(s);
    };
    r.onerror = () => reject(new Error("Could not read file."));
    r.readAsDataURL(file);
  });
}

export default function NewBatchPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const {
    value: form,
    setValue: setForm,
    hasRestoredDraft,
    draftSavedAt,
    discardDraft,
    clearDraft,
  } = useAutoSavedForm<BatchDraft>("batches:new", INITIAL_DRAFT);
  const {
    name,
    trainerId,
    startDate,
    endDate,
    zoomLink,
    visibility,
    selectedCourseIds,
    enrollmentInrByCourseId,
    paymentByCourseId,
    completionCoinsByCourseId,
    completionBadgesByCourseId,
  } = form;

  function update<K extends keyof BatchDraft>(field: K, value: BatchDraft[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  function updateEnrollmentInr(id: string, value: string) {
    setForm((prev) => ({
      ...prev,
      enrollmentInrByCourseId: { ...prev.enrollmentInrByCourseId, [id]: value },
    }));
  }
  function updatePayment(id: string, patch: Partial<{ upiManual: boolean; razorpay: boolean }>) {
    setForm((prev) => ({
      ...prev,
      paymentByCourseId: {
        ...prev.paymentByCourseId,
        [id]: {
          ...(prev.paymentByCourseId[id] ?? { upiManual: true, razorpay: true }),
          ...patch,
        },
      },
    }));
  }
  function updateCompletionCoins(id: string, value: string) {
    setForm((prev) => ({
      ...prev,
      completionCoinsByCourseId: { ...prev.completionCoinsByCourseId, [id]: value },
    }));
  }
  function updateCompletionBadges(id: string, updater: (prev: string[]) => string[]) {
    setForm((prev) => ({
      ...prev,
      completionBadgesByCourseId: {
        ...prev.completionBadgesByCourseId,
        [id]: updater(prev.completionBadgesByCourseId[id] ?? []),
      },
    }));
  }

  // Image data URLs and names are intentionally NOT auto-saved (see BatchDraft comment).
  const [manualUpiQrDataUrl, setManualUpiQrDataUrl] = useState("");
  const [manualUpiQrName, setManualUpiQrName] = useState("");
  const [badgeOptions, setBadgeOptions] = useState<BadgeOption[]>([]);
  const [showFallbackQrUploader, setShowFallbackQrUploader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [platformUpiSummary, setPlatformUpiSummary] = useState<PlatformUpiSummaryState>("idle");
  const needsPlatformUpiInfo = useMemo(() => {
    return selectedCourseIds.some((sid) => {
      const raw = enrollmentInrByCourseId[sid]?.trim();
      const rupees = raw === undefined || raw === "" ? NaN : Number(raw);
      if (!Number.isFinite(rupees) || rupees < 1) return false;
      const pm = paymentByCourseId[sid] ?? { upiManual: true, razorpay: true };
      return pm.upiManual;
    });
  }, [selectedCourseIds, enrollmentInrByCourseId, paymentByCourseId]);

  useEffect(() => {
    if (!needsPlatformUpiInfo) {
      setPlatformUpiSummary("idle");
      return;
    }
    let cancelled = false;
    setPlatformUpiSummary("loading");
    api<PaymentUpiConfigApiResponse>("/api/admin/payment-upi/config")
      .then((r) => {
        if (!cancelled) setPlatformUpiSummary(mapPaymentUpiApiToSummary(r));
      })
      .catch(() => {
        if (!cancelled) setPlatformUpiSummary("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [needsPlatformUpiInfo]);

  useEffect(() => {
    api<CourseOption[]>("/api/courses").then((r) => {
      if (r.success && Array.isArray(r.data)) setCourses(r.data.filter((c) => c.status !== "ARCHIVED"));
    });
    api<BadgeOption[]>("/api/admin/badges")
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          setBadgeOptions(
            r.data.filter(
              (b) => b.isActive !== false && (b.awardMode === "AUTO" || b.awardMode === "BOTH")
            )
          );
        }
      })
      .catch(() => setBadgeOptions([]));
  }, []);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    );
  }, [courses, courseSearch]);

  function courseIsDemo(id: string) {
    const c = courses.find((x) => x.id === id || x.courseId === id);
    return !!c?.isDemo;
  }

  function courseHasCardImage(id: string) {
    const c = courses.find((x) => x.id === id || x.courseId === id);
    return !!String(c?.headerImageUrl ?? "").trim();
  }

  function toggleCourse(id: string) {
    if (!selectedCourseIds.includes(id) && !courseHasCardImage(id)) {
      setError("This course has no card image. Add one on the course before adding it to a batch.");
      return;
    }
    setError("");
    setForm((prev) => {
      if (prev.selectedCourseIds.includes(id)) {
        const enrollment = { ...prev.enrollmentInrByCourseId };
        delete enrollment[id];
        const payment = { ...prev.paymentByCourseId };
        delete payment[id];
        const coins = { ...prev.completionCoinsByCourseId };
        delete coins[id];
        const badges = { ...prev.completionBadgesByCourseId };
        delete badges[id];
        return {
          ...prev,
          selectedCourseIds: prev.selectedCourseIds.filter((x) => x !== id),
          enrollmentInrByCourseId: enrollment,
          paymentByCourseId: payment,
          completionCoinsByCourseId: coins,
          completionBadgesByCourseId: badges,
        };
      }
      const demo = courseIsDemo(id);
      return {
        ...prev,
        selectedCourseIds: [...prev.selectedCourseIds, id],
        enrollmentInrByCourseId: {
          ...prev.enrollmentInrByCourseId,
          [id]: demo ? "0" : (prev.enrollmentInrByCourseId[id] ?? ""),
        },
        paymentByCourseId: {
          ...prev.paymentByCourseId,
          [id]: prev.paymentByCourseId[id] ?? { upiManual: true, razorpay: true },
        },
        completionCoinsByCourseId: {
          ...prev.completionCoinsByCourseId,
          [id]: prev.completionCoinsByCourseId[id] ?? "0",
        },
        completionBadgesByCourseId: {
          ...prev.completionBadgesByCourseId,
          [id]: prev.completionBadgesByCourseId[id] ?? [],
        },
      };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (selectedCourseIds.length === 0) {
      setError("Select at least one course.");
      return;
    }
    setLoading(true);
    try {
      const courseEnrollmentPrices: Record<string, number> = {};
      const coursePaymentMethods: Record<string, { upiManual: boolean; razorpay: boolean }> = {};
      const courseCompletionRewardCoins: Record<string, number> = {};
      const courseCompletionBadgeTypes: Record<string, string[]> = {};
      for (const sid of selectedCourseIds) {
        if (courseIsDemo(sid)) continue;
        const raw = enrollmentInrByCourseId[sid]?.trim();
        const rupees = raw === undefined || raw === "" ? NaN : Number(raw);
        if (raw !== undefined && raw !== "" && Number.isFinite(rupees)) {
          courseEnrollmentPrices[sid] = rupees;
        }
        if (Number.isFinite(rupees) && rupees >= 1) {
          const pm = paymentByCourseId[sid] ?? { upiManual: true, razorpay: true };
          if (!pm.upiManual && !pm.razorpay) {
            setError("For each paid course (₹1+), enable at least one checkout option: QR + UTR or online checkout.");
            setLoading(false);
            return;
          }
          coursePaymentMethods[sid] = { upiManual: pm.upiManual, razorpay: pm.razorpay };
        }
        const coinRaw = completionCoinsByCourseId[sid]?.trim();
        const coins = coinRaw === undefined || coinRaw === "" ? 0 : Math.floor(Number(coinRaw));
        courseCompletionRewardCoins[sid] = Number.isFinite(coins) && coins >= 0 ? Math.min(1_000_000, coins) : 0;
        const badges = (completionBadgesByCourseId[sid] ?? []).map((b) => b.trim()).filter(Boolean);
        if (badges.length > 0) courseCompletionBadgeTypes[sid] = badges;
      }
      const res = await api("/api/batches", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          courseIds: selectedCourseIds,
          trainerId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          zoomLink: zoomLink || undefined,
          visibility,
          ...(Object.keys(courseEnrollmentPrices).length > 0 ? { courseEnrollmentPrices } : {}),
          ...(Object.keys(coursePaymentMethods).length > 0 ? { coursePaymentMethods } : {}),
          ...(manualUpiQrDataUrl.trim() ? { manualUpiQrUrl: manualUpiQrDataUrl.trim() } : {}),
          ...(selectedCourseIds.length > 0 ? { courseCompletionRewardCoins } : {}),
          ...(Object.keys(courseCompletionBadgeTypes).length > 0 ? { courseCompletionBadgeTypes } : {}),
        }),
      });
      if (!res.success) {
        setError(res.message ?? "Failed to create batch.");
        setLoading(false);
        return;
      }
      clearDraft();
      router.push("/batches");
    } catch {
      setError("Failed to create batch.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/batches" />
      <div className="shrink-0 pb-4">
        <BackLink href="/batches">Back to Batches</BackLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Create batch</h2>
          <p className="mt-1 text-sm text-slate-600">
            Build one batch with one or more courses, set per-course fee/payment options, and (optional) batch UPI QR.
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-8">
          {hasRestoredDraft && draftSavedAt !== null && (
            <DraftRestoredBanner savedAt={draftSavedAt} onDiscard={discardDraft} />
          )}
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Basic info</h3>
            <div className="mt-3 grid gap-6 sm:grid-cols-1 w-full">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Batch Name</label>
              <input
                required
                value={name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="e.g. Robotics Jan 2025"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Trainer / batch lead</label>
              <TrainerSelect value={trainerId} onChange={(v) => update("trainerId", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Start Date</label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Zoom Link</label>
              <input
                value={zoomLink}
                onChange={(e) => update("zoomLink", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Visibility in student explore</label>
              <select
                value={visibility}
                onChange={(e) => update("visibility", e.target.value as "PUBLIC" | "PRIVATE")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="PUBLIC">Public (visible in Explore courses)</option>
                <option value="PRIVATE">Private (hidden from Explore courses)</option>
              </select>
            </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Schedule & meeting</h3>
            <div className="mt-3 grid gap-6 sm:grid-cols-1 w-full">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fallback QR image (optional)</label>
              <p className="mb-2 text-xs text-slate-600">
                For <strong className="font-semibold text-slate-700">QR + UTR</strong> checkout, students get a direct static QR generated from the active platform UPI and exact course amount.
                Keep upload disabled unless you need a fallback image for emergency/manual override. Platform payee UPI is set in the panel below and in{" "}
                <Link href="/payment-qr" className="font-semibold text-teal-700 hover:underline">
                  UPI &amp; QR center
                </Link>
                .
              </p>
              {!showFallbackQrUploader && !manualUpiQrDataUrl ? (
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowFallbackQrUploader(true)}
                >
                  Add fallback QR image
                </button>
              ) : (
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  className="block w-full max-w-md text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-700"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void readImageFileAsDataUrl(f)
                      .then((url) => {
                        setManualUpiQrDataUrl(url);
                        setManualUpiQrName(f.name);
                      })
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Invalid image"));
                    e.target.value = "";
                  }}
                />
              )}
              {manualUpiQrDataUrl ? (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <img src={manualUpiQrDataUrl} alt="UPI QR preview" className="h-32 w-32 rounded-lg border border-slate-200 object-contain" />
                  <div className="text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{manualUpiQrName || "Selected image"}</p>
                    <button
                      type="button"
                      className="mt-1 font-semibold text-rose-700 hover:underline"
                      onClick={() => {
                        setManualUpiQrDataUrl("");
                        setManualUpiQrName("");
                      }}
                    >
                      Remove image
                    </button>
                  </div>
                </div>
              ) : null}
              {needsPlatformUpiInfo ? (
                <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <p className="font-semibold text-slate-900">UPI ID &amp; payee name (what learners pay into)</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    When <strong>QR + UTR</strong> is on for a paid course, the LMS builds a static QR for students
                    using the values below and the current amount due.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    If static QR cannot be generated (missing config / error), students automatically see the fallback batch QR only when you upload one above.
                  </p>
                  <PlatformUpiCheckoutSummary
                    state={needsPlatformUpiInfo && platformUpiSummary === "idle" ? "loading" : platformUpiSummary}
                    variant="panel"
                  />
                </div>
              ) : null}
            </div>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Courses &amp; pricing</h3>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">
                  Tick courses for this cohort; expand below each title for fee (INR) and checkout behaviour. Fee blank or below ₹1 means no paid enrollment flow.
                </p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Included: <span className="text-teal-700">{selectedCourseIds.length}</span>
              </p>
            </div>
            <div className="mt-4">
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search courses…"
                className="mb-4 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <div className="space-y-3 overflow-x-hidden rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                {filteredCourses.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    {courseSearch.trim()
                      ? "No courses match your search."
                      : "No courses available yet."}
                  </p>
                ) : (
                  filteredCourses.map((c) => {
                    const checked = selectedCourseIds.includes(c.id);
                    const demo = !!c.isDemo;
                    const isLP = c.deliveryMode === "LEARNING_PLAN";
                    const raw = enrollmentInrByCourseId[c.id]?.trim();
                    const ru = demo ? 0 : raw === "" || raw === undefined ? NaN : Number(raw);
                    const payControls = !demo && Number.isFinite(ru) && ru >= 1;
                    const pm = paymentByCourseId[c.id] ?? { upiManual: true, razorpay: true };
                    return (
                      <div key={c.id} className="rounded-xl border border-white bg-white shadow-sm shadow-slate-900/5">
                        <label className="flex cursor-pointer gap-3 px-4 py-4">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCourse(c.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap justify-between gap-3">
                              <span className="font-semibold text-slate-900">
                                {c.title}
                                {c.isDemo ? (
                                  <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                                    Demo
                                  </span>
                                ) : null}
                                {!String(c.headerImageUrl ?? "").trim() ? (
                                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                                    No image
                                  </span>
                                ) : null}
                              </span>
                              <button
                                type="button"
                                className={`text-xs font-semibold underline-offset-2 hover:underline ${checked ? "text-rose-700" : "pointer-events-none text-transparent"}`}
                                onClick={(evt) => {
                                  evt.preventDefault();
                                  evt.stopPropagation();
                                  if (checked) toggleCourse(c.id);
                                }}
                              >
                                Remove course
                              </button>
                            </div>
                            {checked ? (
                              <div className="border-t border-slate-100 pt-3 space-y-3">
                                {isLP ? (
                                  <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
                                    <p className="text-xs font-semibold text-teal-800">Learning Plan Course</p>
                                    <p className="mt-1 text-xs text-teal-700">Students pay per milestone. Enrollment is free. Fee is configured in the Learning Plan settings.</p>
                                  </div>
                                ) : (
                                  <>
                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                                  <label className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    Course fee (₹ INR)
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      placeholder={demo ? "0" : "Optional"}
                                      value={demo ? "0" : (enrollmentInrByCourseId[c.id] ?? "")}
                                      onChange={(e) => updateEnrollmentInr(c.id, e.target.value)}
                                      disabled={demo}
                                      className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                    <span className="normal-case tracking-normal font-normal text-slate-400">
                                      {demo
                                        ? "Demo courses are free (₹0) and auto-enroll all students when added to this batch."
                                        : "Leave blank when access is complimentary."}
                                    </span>
                                  </label>
                                  <label className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    Completion coins (FUNT)
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      placeholder="0"
                                      value={completionCoinsByCourseId[c.id] ?? "0"}
                                      onChange={(e) => updateCompletionCoins(c.id, e.target.value)}
                                      className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
                                    />
                                    <span className="normal-case font-normal text-slate-400">
                                      Per course, like the fee—credited when they earn a certificate for this course in the batch.
                                    </span>
                                  </label>
                                  <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    <span>Completion badges</span>
                                    <span className="normal-case font-normal text-slate-400">Select one or more badges:</span>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      {badgeOptions.map((b) => {
                                        const selected = (completionBadgesByCourseId[c.id] ?? []).includes(b.badgeType);
                                        return (
                                          <label
                                            key={b.badgeType}
                                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                                              selected
                                                ? "border-teal-300 bg-teal-50 text-teal-800"
                                                : "border-slate-300 bg-white text-slate-600"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={selected}
                                              onChange={(e) =>
                                                updateCompletionBadges(c.id, (prev) =>
                                                  e.target.checked
                                                    ? [...new Set([...prev, b.badgeType])]
                                                    : prev.filter((x) => x !== b.badgeType)
                                                )
                                              }
                                              className="rounded border-slate-300 text-teal-600"
                                            />
                                            {b.displayName}
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <span className="normal-case font-normal text-slate-400">
                                      Auto-awarded on this course completion (certificate).
                                    </span>
                                  </div>
                                </div>
                                {payControls ? (
                                  <div className="rounded-lg bg-slate-50 px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                      Checkout modes for learners (pick one or both)
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-5 text-xs font-semibold text-slate-700">
                                      <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={pm.upiManual}
                                          onChange={(e) => updatePayment(c.id, { upiManual: e.target.checked })}
                                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        QR scan + manual payment proof (UTR)
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={pm.razorpay}
                                          onChange={(e) => updatePayment(c.id, { razorpay: e.target.checked })}
                                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        Hosted online checkout
                                      </label>
                                    </div>
                                    {pm.upiManual ? (
                                      <PlatformUpiCheckoutSummary
                                        state={needsPlatformUpiInfo && platformUpiSummary === "idle" ? "loading" : platformUpiSummary}
                                        variant="inline"
                                      />
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="text-[11px] leading-relaxed text-slate-400">
                                    Payment controls unlock once fee is ₹1 or higher.
                                  </p>
                                )}
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Checkout surfaces only what you enable above — learners never toggle gateways themselves. Hosted checkout requires Razorpay keys on the server.
            </p>
          </section>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            <button
              type="submit"
              disabled={loading || selectedCourseIds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating batch…
                </>
              ) : (
                "Create Batch"
              )}
            </button>
            <Link
              href="/batches"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
