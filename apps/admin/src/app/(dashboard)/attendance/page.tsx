"use client";

import { useEffect, useState } from "react";
import { AppPageShell } from "@/components/ui";
import { api } from "@/lib/api";

interface EventSummary {
  id: string;
  eventDate: string;
  title?: string;
  markedBy: string;
  presentCount: number;
  createdAt: string;
}

interface EventDetail {
  id: string;
  eventDate: string;
  title?: string;
  markedBy: string;
  presentStudents: Array<{ studentId: string; username: string; name: string }>;
  createdAt: string;
}

export default function AttendancePage() {
  const [eventDate, setEventDate] = useState("");
  const [title, setTitle] = useState("");
  const [usernamesPaste, setUsernamesPaste] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [addPresentPaste, setAddPresentPaste] = useState("");
  const [addPresentLoading, setAddPresentLoading] = useState(false);
  const [addPresentMessage, setAddPresentMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function loadEvents() {
    setEventsLoading(true);
    api<EventSummary[]>("/api/general-attendance").then((r) => {
      if (r.success && Array.isArray(r.data)) setEvents(r.data);
      setEventsLoading(false);
    });
  }

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    api<EventDetail>(`/api/general-attendance/${detailId}`).then((r) => {
      if (r.success && r.data) setDetail(r.data);
      else setDetail(null);
    });
  }, [detailId]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    const raw = usernamesPaste.trim();
    if (!raw) {
      setCreateMessage({ type: "error", text: "Paste at least one username." });
      return;
    }
    const usernames = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (usernames.length === 0) {
      setCreateMessage({ type: "error", text: "Paste at least one username." });
      return;
    }
    const date = eventDate || new Date().toISOString().slice(0, 10);
    setCreateLoading(true);
    setCreateMessage(null);
    const res = await api<{ notFound?: string[] }>("/api/general-attendance", {
      method: "POST",
      body: JSON.stringify({ eventDate: date, title: title.trim() || undefined, usernames }),
    });
    setCreateLoading(false);
    if (res.success) {
      setCreateMessage({
        type: "success",
        text: res.data?.notFound?.length
          ? `Event created. Not found: ${res.data.notFound.join(", ")}`
          : "Event attendance created.",
      });
      setEventDate("");
      setTitle("");
      setUsernamesPaste("");
      loadEvents();
    } else {
      setCreateMessage({ type: "error", text: res.message ?? "Failed to create event." });
    }
  }

  async function addRemainingToEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!detailId) return;
    const raw = addPresentPaste.trim();
    if (!raw) {
      setAddPresentMessage({ type: "error", text: "Paste at least one username." });
      return;
    }
    const usernames = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (usernames.length === 0) {
      setAddPresentMessage({ type: "error", text: "Paste at least one username." });
      return;
    }
    setAddPresentLoading(true);
    setAddPresentMessage(null);
    const res = await api<{ addedCount?: number; alreadyMarkedCount?: number; notFound?: string[] }>(`/api/general-attendance/${detailId}/add-present`, {
      method: "PATCH",
      body: JSON.stringify({ usernames }),
    });
    setAddPresentLoading(false);
    if (res.success && res.data) {
      const added = res.data.addedCount ?? 0;
      const already = res.data.alreadyMarkedCount ?? 0;
      const nf = res.data.notFound?.length ? ` Not found: ${res.data.notFound.join(", ")}` : "";
      setAddPresentMessage({ type: "success", text: `Added ${added} present. Already marked: ${already}.${nf}` });
      setAddPresentPaste("");
      loadEvents();
      if (detailId) {
        api<EventDetail>(`/api/general-attendance/${detailId}`).then((r) => {
          if (r.success && r.data) setDetail(r.data);
        });
      }
    } else {
      setAddPresentMessage({ type: "error", text: res.message ?? "Failed to add." });
    }
  }

  return (
    <AppPageShell>
      {}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 px-6 py-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              Create events by date and paste student usernames to mark who was present.
            </p>
          </div>
        </div>
      </div>

      {}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100 overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-6 py-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Create event</h2>
          <p className="mt-1 text-sm text-slate-600">Date, optional title, and usernames (comma or newline).</p>
        </div>
        <form onSubmit={createEvent} className="p-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Event date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bootcamp Day 1, Workshop Q1"
                className="input w-full text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Student usernames</label>
            <textarea
              value={usernamesPaste}
              onChange={(e) => { setUsernamesPaste(e.target.value); setCreateMessage(null); }}
              placeholder="Paste CSV or one per line: student.one, student.two"
              rows={5}
              className="input w-full text-sm font-mono"
            />
          </div>
          {createMessage && (
            <div
              className={createMessage.type === "success" ? "alert--success" : "alert--error"}
            >
              {createMessage.type === "success" ? (
                <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="text-sm font-medium">{createMessage.text}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={createLoading || !usernamesPaste.trim()}
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            {createLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating…
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create event & mark attendance
              </>
            )}
          </button>
        </form>
      </div>

      {}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100 overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Events</h2>
          <p className="mt-1 text-sm text-slate-600">Click an event to see who was marked present and add more if needed.</p>
          {!eventsLoading && events.length > 0 && (
            <p className="mt-3 text-xs font-medium text-slate-500">{events.length} event{events.length !== 1 ? "s" : ""}</p>
          )}
        </div>
        <div className="p-6">
          {eventsLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="spinner" />
              <p className="mt-4 text-sm text-slate-500">Loading events…</p>
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-600">No events yet</p>
              <p className="mt-1 text-sm text-slate-500">Create your first event above.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => {
                const isOpen = detailId === ev.id;
                return (
                  <li
                    key={ev.id}
                    className={`rounded-xl border transition-all ${
                      isOpen ? "border-indigo-200 bg-indigo-50/30 shadow-md" : "border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{ev.title || "Event"}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-lg bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {new Date(ev.eventDate).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {ev.presentCount} present
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailId(isOpen ? null : ev.id)}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition ${
                          isOpen
                            ? "border border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-200/80"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {isOpen ? (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                            Hide list
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            View list
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {}
      {detail && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100 overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{detail.title || "Event"}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {new Date(detail.eventDate).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
          <div className="p-6 space-y-8">
            <div className="rounded-xl border border-slate-200 shadow-inner overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Present ({detail.presentStudents.length})
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 font-mono">Username</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.presentStudents.map((s, i) => (
                    <tr key={s.studentId} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-4 py-3 font-medium text-slate-900">{s.name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-xs">{s.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Add remaining present
              </h3>
              <p className="mt-1 text-xs text-slate-600">Paste usernames to add more. Already marked are skipped (no duplicates).</p>
              <form onSubmit={addRemainingToEvent} className="mt-4 space-y-3">
                <textarea
                  value={addPresentPaste}
                  onChange={(e) => { setAddPresentPaste(e.target.value); setAddPresentMessage(null); }}
                  placeholder="FS-26-00003, FS-26-00004"
                  rows={3}
                  className="input w-full text-sm font-mono"
                />
                {addPresentMessage && (
                  <div
                    className={addPresentMessage.type === "success" ? "alert--success" : "alert--error"}
                  >
                    <p className="text-sm font-medium">{addPresentMessage.text}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={addPresentLoading || !addPresentPaste.trim()}
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  {addPresentLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : null}
                  {addPresentLoading ? "Adding…" : "Add remaining"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
