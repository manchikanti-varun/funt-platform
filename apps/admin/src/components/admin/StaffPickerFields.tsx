"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type StaffPickerRow = {
  id: string;
  username: string;
  name: string;
  roles: string[];
};

type TrainerSelectProps = {
  value: string;
  onChange: (userIdOrUsername: string) => void;
  disabled?: boolean;
  /** When false, HTML `required` is omitted (e.g. read-only batch view for trainers). */
  required?: boolean;
};

/** Batch lead: trainers, admins, super admins — pick by name instead of typing Mongo id */
export function TrainerSelect({ value, onChange, disabled, required = true }: TrainerSelectProps) {
  const [rows, setRows] = useState<StaffPickerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api<StaffPickerRow[]>("/api/admin/staff-picker?variant=trainer")
      .then((r) => {
        if (!cancelled && r.success && Array.isArray(r.data)) setRows(r.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const match = rows.find((u) => u.id === value || u.username.toLowerCase() === String(value).toLowerCase());
  const showLegacy = Boolean(value.trim() && !match);

  return (
    <div className="space-y-1">
      <select
        required={required}
        disabled={disabled || loading}
        value={match ? match.id : showLegacy ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
      >
        <option value="">{loading ? "Loading staff…" : "Select trainer / lead"}</option>
        {showLegacy ? (
          <option value={value}>
            Current value (re-select): {value}
          </option>
        ) : null}
        {rows.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} (@{u.username})
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500">
        Choose who leads this batch (trainer accounts and admins). Matches server validation for batch trainer.
      </p>
    </div>
  );
}

type ModeratorCheckboxesProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

/** Co-editors: admins & super admins except yourself */
export function ModeratorCheckboxes({ selectedIds, onChange }: ModeratorCheckboxesProps) {
  const [rows, setRows] = useState<StaffPickerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api<StaffPickerRow[]>("/api/admin/staff-picker?variant=moderators&excludeSelf=1")
      .then((r) => {
        if (!cancelled && r.success && Array.isArray(r.data)) setRows(r.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading admins…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No other admins available to add as moderators.</p>;
  }

  return (
    <ul className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      {rows.map((u) => (
        <li key={u.id}>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white">
            <input
              type="checkbox"
              checked={selectedIds.includes(u.id)}
              onChange={() => toggle(u.id)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-800">
              <span className="font-medium">{u.name}</span>{" "}
              <span className="text-slate-500">@{u.username}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
