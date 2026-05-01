"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { isTrainerOnly } from "@/lib/auth";
import { useAdminUser } from "@/contexts/AdminUserContext";
import { BATCH_STATUS } from "@funt-platform/constants";
import { BackLink } from "@/components/ui/BackLink";
import { RequireRoles, STAFF_ROLES } from "@/components/auth/RequireRoles";
import { TrainerSelect } from "@/components/admin/StaffPickerFields";
import {
  mapPaymentUpiApiToSummary,
  PlatformUpiCheckoutSummary,
  type PaymentUpiConfigApiResponse,
  type PlatformUpiSummaryState,
} from "@/components/admin/PlatformUpiCheckoutSummary";

interface Batch {
  id: string;
  name: string;
  trainerId: string;
  trainerName?: string;
  trainerUsername?: string;
  startDate: string;
  endDate?: string;
  zoomLink?: string;
  status: string;
  certificatePriceCoins?: number;
  manualUpiQrUrl?: string;
  courseSnapshot?: { title?: string; courseId?: string; enrollmentPriceInPaise?: number; allowedPaymentMethods?: string[]; completionRewardCoins?: number; completionBadgeTypes?: string[] };
  courseSnapshots?: Array<{
    title?: string;
    courseId?: string;
    enrollmentPriceInPaise?: number;
    allowedPaymentMethods?: string[];
    completionRewardCoins?: number;
    completionBadgeTypes?: string[];
  }>;
}

interface CourseOption {
  id: string;
  title: string;
  status: string;
}

interface BadgeOption {
  badgeType: string;
  displayName: string;
  isActive?: boolean;
  awardMode?: "MANUAL" | "AUTO" | "BOTH";
}

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

const MAX_QR_FILE_BYTES = 350_000;

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose a PNG, JPEG, GIF, or WebP image."));
      return;
    }
    if (file.size > MAX_QR_FILE_BYTES) {
      reject(new Error("Image must be under about 350 KB."));
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

export default function EditBatchPage() {
  const { roles } = useAdminUser();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [batch, setBatch] = useState<Batch | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [name, setName] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [enrollmentInrByCourseId, setEnrollmentInrByCourseId] = useState<Record<string, string>>({});
  const [paymentByCourseId, setPaymentByCourseId] = useState<Record<string, { upiManual: boolean; razorpay: boolean }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trainerOnly, setTrainerOnly] = useState(false);
  const [upiQrNewDataUrl, setUpiQrNewDataUrl] = useState<string | null>(null);
  const [upiQrRemoved, setUpiQrRemoved] = useState(false);
  const [upiQrPickName, setUpiQrPickName] = useState("");
  const [completionCoinsByCourseId, setCompletionCoinsByCourseId] = useState<Record<string, string>>({});
  const [completionBadgesByCourseId, setCompletionBadgesByCourseId] = useState<Record<string, string[]>>({});
  const [badgeOptions, setBadgeOptions] = useState<BadgeOption[]>([]);
  const [showFallbackQrUploader, setShowFallbackQrUploader] = useState(false);
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
    setTrainerOnly(isTrainerOnly(roles));
  }, [roles]);

  useEffect(() => {
    if (!id) return;
    api<Batch>(`/api/batches/${id}`).then((r) => {
      if (r.success && r.data) {
        setUpiQrNewDataUrl(null);
        setUpiQrRemoved(false);
        setUpiQrPickName("");
        setShowFallbackQrUploader(!!r.data.manualUpiQrUrl);
        setBatch(r.data);
        setName(r.data.name);
        const ids = Array.isArray(r.data.courseSnapshots) && r.data.courseSnapshots.length > 0
          ? r.data.courseSnapshots.map((s) => s.courseId ?? "").filter(Boolean)
          : (r.data.courseSnapshot?.courseId ? [r.data.courseSnapshot.courseId] : []);
        setSelectedCourseIds(ids);
        setTrainerId(r.data.trainerId);
        setStartDate(r.data.startDate ? r.data.startDate.slice(0, 10) : "");
        setEndDate(r.data.endDate ? r.data.endDate.slice(0, 10) : "");
        setZoomLink(r.data.zoomLink ?? "");
        const snaps =
          Array.isArray(r.data.courseSnapshots) && r.data.courseSnapshots.length > 0
            ? r.data.courseSnapshots
            : r.data.courseSnapshot
              ? [r.data.courseSnapshot]
              : [];
        const priceMap: Record<string, string> = {};
        const methodMap: Record<string, { upiManual: boolean; razorpay: boolean }> = {};
        for (const s of snaps) {
          const cid = s.courseId ?? "";
          if (!cid) continue;
          const paise = Math.max(0, Math.floor(Number(s.enrollmentPriceInPaise ?? 0)));
          priceMap[cid] = paise > 0 ? (paise / 100).toFixed(2).replace(/\.?0+$/, "") : "";
          const arr = Array.isArray(s.allowedPaymentMethods) ? s.allowedPaymentMethods : [];
          const norm = arr.filter((x) => x === "UPI_MANUAL" || x === "RAZORPAY");
          if (norm.length === 0) {
            methodMap[cid] = { upiManual: true, razorpay: true };
          } else {
            methodMap[cid] = { upiManual: norm.includes("UPI_MANUAL"), razorpay: norm.includes("RAZORPAY") };
          }
        }
        setEnrollmentInrByCourseId(priceMap);
        setPaymentByCourseId(methodMap);
        const coinMap: Record<string, string> = {};
        const badgeMap: Record<string, string[]> = {};
        for (const s of snaps) {
          const cid = s.courseId ?? "";
          if (!cid) continue;
          coinMap[cid] = String(Math.max(0, Math.floor(Number(s.completionRewardCoins ?? 0))));
          const badges = Array.isArray((s as { completionBadgeTypes?: string[] }).completionBadgeTypes)
            ? ((s as { completionBadgeTypes?: string[] }).completionBadgeTypes ?? [])
            : [];
          badgeMap[cid] = badges;
        }
        setCompletionCoinsByCourseId(coinMap);
        setCompletionBadgesByCourseId(badgeMap);
      }
    });
  }, [id]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const courseEnrollmentPrices: Record<string, number> = {};
    const coursePaymentMethods: Record<string, { upiManual: boolean; razorpay: boolean }> = {};
    const courseCompletionBadgeTypes: Record<string, string[]> = {};
    for (const sid of selectedCourseIds) {
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
      const badges = (completionBadgesByCourseId[sid] ?? []).map((b) => b.trim()).filter(Boolean);
      if (badges.length > 0) courseCompletionBadgeTypes[sid] = badges;
    }
    const courseCompletionRewardCoins: Record<string, number> = {};
    for (const sid of selectedCourseIds) {
      const raw = completionCoinsByCourseId[sid]?.trim();
      const n = raw === undefined || raw === "" ? 0 : Math.floor(Number(raw));
      courseCompletionRewardCoins[sid] = Number.isFinite(n) && n >= 0 ? Math.min(1_000_000, n) : 0;
    }
    const body: Record<string, unknown> = {
      name,
      courseIds: selectedCourseIds.length > 0 ? selectedCourseIds : undefined,
      trainerId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      zoomLink: zoomLink || undefined,
      ...(selectedCourseIds.length > 0 ? { courseCompletionRewardCoins } : {}),
      ...(Object.keys(courseCompletionBadgeTypes).length > 0 ? { courseCompletionBadgeTypes } : {}),
      ...(Object.keys(courseEnrollmentPrices).length > 0 ? { courseEnrollmentPrices } : {}),
      ...(Object.keys(coursePaymentMethods).length > 0 ? { coursePaymentMethods } : {}),
    };
    if (upiQrRemoved) body.manualUpiQrUrl = null;
    else if (upiQrNewDataUrl) body.manualUpiQrUrl = upiQrNewDataUrl;

    const res = await api(`/api/batches/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.success) router.push("/batches");
    else setError(res.message ?? "Failed to update.");
  }

  async function archive() {
    if (!confirm("Archive this batch? Students will no longer see it in Explore.")) return;
    const res = await api(`/api/batches/${id}/archive`, { method: "PATCH" });
    if (res.success) router.push("/batches");
    else setError(res.message ?? "Failed to archive.");
  }

  if (!batch) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        <p className="mt-4 text-sm text-slate-500">Loading batch…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <RequireRoles roles={[...STAFF_ROLES]} fallbackHref="/batches" />
      <div className="shrink-0 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href="/batches">Back to Batches</BackLink>
          <Link
            href={`/batches/${id}/submissions`}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Assignment submissions
          </Link>
          <Link
            href={`/batches/${id}/attendance`}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Attendance
          </Link>
          <Link
            href={`/batches/${id}/certificates`}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 shadow-sm transition hover:bg-violet-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Certificates
          </Link>
          <Link
            href={`/batches/${id}/settings`}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm transition hover:bg-amber-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              batch.status === BATCH_STATUS.ARCHIVED ? "bg-slate-100 text-slate-600" : "bg-teal-100 text-teal-700"
            }`}
          >
            {batch.status === BATCH_STATUS.ARCHIVED ? "Archived" : "Active"}
          </span>
          {!trainerOnly && (
            <button
              type="button"
              onClick={archive}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50"
            >
              Archive batch
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-6 py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Edit batch</h1>
          <p className="mt-1 text-sm text-slate-600">Update courses, course fees, payment modes, schedule, and batch-level manual UPI QR.</p>
          <div className="mt-2 inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            Snapshot context
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-8">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Basic info</h2>
            <div className="mt-3 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Batch name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q1 2025 – Full stack"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Trainer / batch lead</label>
                <TrainerSelect
                  value={trainerId}
                  onChange={setTrainerId}
                  disabled={trainerOnly}
                  required={!trainerOnly}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Courses & payment setup</h2>
            <p className="mt-1 text-sm text-slate-500">Select one or more courses included in this batch. Order is preserved.</p>
            <p className="mt-1 text-xs text-slate-500">
              Student access and license keys:{" "}
              <Link href={`/batches/${id}/view`} className="font-medium text-teal-700 hover:underline">
                batch view → Courses
              </Link>
              .
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search courses…"
                className={`${INPUT_CLASS} mb-2 max-w-md`}
              />
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                {courses
                  .filter((c) => !courseSearch.trim() || c.title.toLowerCase().includes(courseSearch.trim().toLowerCase()))
                  .map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-slate-200 hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(c.id)}
                        onChange={() => {
                          setSelectedCourseIds((prev) => {
                            if (prev.includes(c.id)) {
                              setEnrollmentInrByCourseId((m) => {
                                const next = { ...m };
                                delete next[c.id];
                                return next;
                              });
                              setPaymentByCourseId((m) => {
                                const next = { ...m };
                                delete next[c.id];
                                return next;
                              });
                              setCompletionCoinsByCourseId((m) => {
                                const next = { ...m };
                                delete next[c.id];
                                return next;
                              });
                              setCompletionBadgesByCourseId((m) => {
                                const next = { ...m };
                                delete next[c.id];
                                return next;
                              });
                              return prev.filter((x) => x !== c.id);
                            }
                            setEnrollmentInrByCourseId((m) => ({ ...m, [c.id]: m[c.id] ?? "" }));
                            setPaymentByCourseId((m) => ({ ...m, [c.id]: m[c.id] ?? { upiManual: true, razorpay: true } }));
                            setCompletionCoinsByCourseId((m) => ({ ...m, [c.id]: m[c.id] ?? "0" }));
                            setCompletionBadgesByCourseId((m) => ({ ...m, [c.id]: m[c.id] ?? [] }));
                            return [...prev, c.id];
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-800">{c.title}</span>
                    </label>
                  ))}
              </div>
              {selectedCourseIds.length > 0 && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {selectedCourseIds.length} course{selectedCourseIds.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
            {selectedCourseIds.length > 0 && (
              <div className="mt-4 space-y-3 rounded-xl border border-teal-100 bg-teal-50/40 p-4">
                <p className="text-sm font-semibold text-slate-800">Per course in this batch: fee &amp; completion coins</p>
                <p className="text-xs text-slate-600">
                  List price (INR) is shown at student checkout. From <strong>₹1</strong> upward, choose manual UPI and/or Razorpay. Separately, set FUNT coins credited when a student earns a certificate for that course in this cohort (0 = none). Certificate <em>price</em> in coins (if any) is still batch-level:{" "}
                  <span className="font-mono">{batch.certificatePriceCoins ?? 0}</span>.
                </p>
                <ul className="space-y-2">
                  {selectedCourseIds.map((sid) => {
                    const title =
                      courses.find((c) => c.id === sid)?.title ??
                      batch?.courseSnapshots?.find((s) => s.courseId === sid)?.title ??
                      sid;
                    const raw = enrollmentInrByCourseId[sid]?.trim();
                    const ru = raw === "" || raw === undefined ? NaN : Number(raw);
                    const showPay = Number.isFinite(ru) && ru >= 1;
                    const pm = paymentByCourseId[sid] ?? { upiManual: true, razorpay: true };
                    return (
                      <li key={sid} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white/90 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                        <span className="min-w-[140px] flex-1 text-sm text-slate-700">{title}</span>
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0"
                            value={enrollmentInrByCourseId[sid] ?? ""}
                            onChange={(e) =>
                              setEnrollmentInrByCourseId((m) => ({ ...m, [sid]: e.target.value }))
                            }
                            className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          />
                          <span className="text-xs text-slate-500">INR fee</span>
                          {showPay ? (
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
                                <label className="flex cursor-pointer items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={pm.upiManual}
                                    onChange={(e) =>
                                      setPaymentByCourseId((m) => ({
                                        ...m,
                                        [sid]: { ...(m[sid] ?? pm), upiManual: e.target.checked },
                                      }))
                                    }
                                    className="rounded border-slate-300 text-teal-600"
                                  />
                                  Manual UPI
                                </label>
                                <label className="flex cursor-pointer items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={pm.razorpay}
                                    onChange={(e) =>
                                      setPaymentByCourseId((m) => ({
                                        ...m,
                                        [sid]: { ...(m[sid] ?? pm), razorpay: e.target.checked },
                                      }))
                                    }
                                    className="rounded border-slate-300 text-teal-600"
                                  />
                                  Razorpay
                                </label>
                              </div>
                              {pm.upiManual ? (
                                <PlatformUpiCheckoutSummary
                                  state={needsPlatformUpiInfo && platformUpiSummary === "idle" ? "loading" : platformUpiSummary}
                                  variant="inline"
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="w-full border-t border-slate-100 pt-2 mt-1 flex flex-wrap items-center gap-2 sm:pl-0">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Completion coins</label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={completionCoinsByCourseId[sid] ?? "0"}
                            onChange={(e) =>
                              setCompletionCoinsByCourseId((m) => ({ ...m, [sid]: e.target.value }))
                            }
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          />
                          <span className="text-xs text-slate-500">Auto-credit on certificate for this course.</span>
                          <div className="ml-4 flex min-w-[320px] flex-col gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Completion badges</label>
                            <div className="flex flex-wrap gap-2">
                              {badgeOptions.map((b) => {
                                const selected = (completionBadgesByCourseId[sid] ?? []).includes(b.badgeType);
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
                                        setCompletionBadgesByCourseId((m) => {
                                          const prev = m[sid] ?? [];
                                          const next = e.target.checked
                                            ? [...new Set([...prev, b.badgeType])]
                                            : prev.filter((x) => x !== b.badgeType);
                                          return { ...m, [sid]: next };
                                        })
                                      }
                                      className="rounded border-slate-300 text-teal-600"
                                    />
                                    {b.displayName}
                                  </label>
                                );
                              })}
                            </div>
                            <span className="text-xs text-slate-500">Auto-award on completion of this course.</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-700">Schedule, meeting & optional batch QR (fallback)</h2>
            <p className="mt-1 text-sm text-slate-500">
              Start/end dates and meeting URL. The batch QR is optional: students normally use an auto-refreshing QR; this image is used only if that path fails or you prefer a fixed graphic.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Start date</label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Zoom / meeting link</label>
                <input
                  type="url"
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                  placeholder="https://zoom.us/j/…"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Fallback QR image (optional)</label>
                <p className="mb-3 text-xs text-slate-600">
                  Students are shown a direct static QR from platform UPI + exact amount. Upload here only as a <strong>fallback</strong> when auto QR cannot be generated, or if you need a fixed manual override image. Max ~350 KB.
                </p>
                {!showFallbackQrUploader && !batch?.manualUpiQrUrl && !upiQrNewDataUrl ? (
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
                          setUpiQrNewDataUrl(url);
                          setUpiQrRemoved(false);
                          setUpiQrPickName(f.name);
                        })
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Invalid image"));
                      e.target.value = "";
                    }}
                  />
                )}
                {(() => {
                  const preview = upiQrRemoved ? null : upiQrNewDataUrl ?? batch?.manualUpiQrUrl ?? null;
                  if (!preview) {
                    return (
                      <p className="mt-3 text-xs text-slate-500">
                        {upiQrRemoved ? "QR will be cleared after you save (server default may still apply)." : "No QR uploaded for this batch yet."}
                      </p>
                    );
                  }
                  return (
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <img src={preview} alt="UPI QR preview" className="h-36 w-36 rounded-lg border border-slate-200 bg-white object-contain" />
                      <div className="flex flex-col gap-2 text-xs">
                        {upiQrNewDataUrl ? <span className="font-medium text-slate-800">{upiQrPickName || "New image"}</span> : null}
                        <button
                          type="button"
                          className="w-fit font-semibold text-rose-700 hover:underline"
                          onClick={() => {
                            setUpiQrRemoved(true);
                            setUpiQrNewDataUrl(null);
                            setUpiQrPickName("");
                          }}
                        >
                          Remove batch QR
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {needsPlatformUpiInfo ? (
                <div className="sm:col-span-2 mt-4 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <p className="font-semibold text-slate-900">Receiving UPI details</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Paid courses with <strong>QR + UTR</strong> use a direct static QR with this UPI and payee. If auto generation fails, students see the optional fallback QR image above.
                  </p>
                  <PlatformUpiCheckoutSummary
                    state={needsPlatformUpiInfo && platformUpiSummary === "idle" ? "loading" : platformUpiSummary}
                    variant="panel"
                  />
                </div>
              ) : null}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save changes"}
            </button>
            <Link
              href="/batches"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
