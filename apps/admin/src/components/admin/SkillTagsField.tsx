"use client";

import { useState, useCallback } from "react";
import { isValidSkillTag, SKILL_TAG, SKILL_TAG_GROUPS } from "@funt-platform/constants";

const ALL_PRESET = Object.values(SKILL_TAG);

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

export function SkillTagsField({ value, onChange }: Props) {
  const [customInput, setCustomInput] = useState("");
  const [customErr, setCustomErr] = useState("");

  const toggle = useCallback(
    (tag: string) => {
      onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
    },
    [value, onChange]
  );

  function addCustomTag(e: React.FormEvent) {
    e.preventDefault();
    const raw = customInput.trim();
    if (!raw) return;
    if (!isValidSkillTag(raw)) {
      setCustomErr("Use 2–48 characters (letters, numbers, spaces, + # . - /).");
      return;
    }
    if (value.some((t) => t.toLowerCase() === raw.toLowerCase())) {
      setCustomErr("That tag is already selected.");
      return;
    }
    setCustomErr("");
    onChange([...value, raw]);
    setCustomInput("");
  }

  const customSelected = value.filter((t) => !ALL_PRESET.includes(t as SKILL_TAG));

  return (
    <div className="space-y-4">
      {SKILL_TAG_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => (
              <label
                key={tag}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-teal-400 hover:bg-teal-50/50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(tag)}
                  onChange={() => toggle(tag)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                {tag}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Custom tags</p>
        <form onSubmit={addCustomTag} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              setCustomErr("");
            }}
            placeholder='e.g. Rust, Vue, "Systems design"'
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <button
            type="submit"
            className="rounded-lg border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            Add tag
          </button>
        </form>
        {customErr ? <p className="mt-1 text-xs text-red-600">{customErr}</p> : null}
        <p className="mt-1 text-xs text-slate-500">Optional labels not in the lists above (same validation as presets).</p>
      </div>

      {customSelected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {customSelected.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {tag}
              <span className="text-slate-400">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
