"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { buttonClass, inputClass } from "@/components/AuthCard";
import { JOB_CATEGORIES, JOB_TYPES, WORK_MODES, normalizeSkillsInput } from "@/lib/jobs";
import type { JobWritePayload } from "@/lib/api";

type JobFormProps = {
  initial?: Partial<JobWritePayload>;
  submitLabel: string;
  onSubmit: (payload: JobWritePayload) => Promise<void>;
};

const empty: JobWritePayload = {
  title: "",
  company_name: "",
  description: "",
  location: "",
  job_type: "full_time",
  work_mode: "hybrid",
  category: "backend",
  experience_min_years: 0,
  experience_max_years: 2,
  salary_min: null,
  salary_max: null,
  currency: "PKR",
  skills: [],
  apply_url: null,
};

export default function JobForm({ initial, submitLabel, onSubmit }: JobFormProps) {
  const [form, setForm] = useState<JobWritePayload>({ ...empty, ...initial });
  const [skillDraft, setSkillDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof JobWritePayload>(key: K, value: JobWritePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addSkill(raw: string) {
    const next = normalizeSkillsInput([...form.skills, raw]);
    if (next.length >= 20 && form.skills.length >= 20) {
      setError("At most 20 skills are allowed");
      return;
    }
    setForm((prev) => ({ ...prev, skills: normalizeSkillsInput([...prev.skills, raw]) }));
    setSkillDraft("");
  }

  function onSkillKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (skillDraft.trim()) addSkill(skillDraft);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.experience_min_years > form.experience_max_years) {
      setError("Minimum experience must be less than or equal to maximum experience");
      return;
    }
    if (
      form.salary_min != null &&
      form.salary_max != null &&
      form.salary_min > form.salary_max
    ) {
      setError("Minimum salary must be less than or equal to maximum salary");
      return;
    }
    if (form.skills.length > 20) {
      setError("At most 20 skills are allowed");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        ...form,
        skills: normalizeSkillsInput(form.skills),
        salary_min: form.salary_min,
        salary_max: form.salary_max,
        apply_url: form.apply_url || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          required
          className={inputClass}
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Company</label>
        <input
          required
          className={inputClass}
          value={form.company_name}
          onChange={(e) => setField("company_name", e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          required
          rows={6}
          className={inputClass}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Location</label>
        <input
          required
          className={inputClass}
          value={form.location}
          onChange={(e) => setField("location", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Job type</label>
          <select
            className={inputClass}
            value={form.job_type}
            onChange={(e) => setField("job_type", e.target.value as JobWritePayload["job_type"])}
          >
            {JOB_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Work mode</label>
          <select
            className={inputClass}
            value={form.work_mode}
            onChange={(e) => setField("work_mode", e.target.value as JobWritePayload["work_mode"])}
          >
            {WORK_MODES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select
            className={inputClass}
            value={form.category}
            onChange={(e) => setField("category", e.target.value as JobWritePayload["category"])}
          >
            {JOB_CATEGORIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Experience min (years)</label>
          <input
            type="number"
            min={0}
            max={50}
            required
            className={inputClass}
            value={form.experience_min_years}
            onChange={(e) => setField("experience_min_years", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Experience max (years)</label>
          <input
            type="number"
            min={0}
            max={50}
            required
            className={inputClass}
            value={form.experience_max_years}
            onChange={(e) => setField("experience_max_years", Number(e.target.value))}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Salary min</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={form.salary_min ?? ""}
            onChange={(e) =>
              setField("salary_min", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Salary max</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={form.salary_max ?? ""}
            onChange={(e) =>
              setField("salary_max", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Currency</label>
          <input
            className={inputClass}
            value={form.currency}
            onChange={(e) => setField("currency", e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Skills</label>
        <input
          className={inputClass}
          value={skillDraft}
          placeholder="Type a skill and press Enter"
          onChange={(e) => setSkillDraft(e.target.value)}
          onKeyDown={onSkillKeyDown}
          onBlur={() => {
            if (skillDraft.trim()) addSkill(skillDraft);
          }}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {form.skills.map((skill) => (
            <button
              key={skill}
              type="button"
              className="rounded-full bg-muted px-3 py-1 text-xs text-foreground/80 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive active:scale-95 cursor-pointer"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  skills: prev.skills.filter((s) => s !== skill),
                }))
              }
            >
              {skill} ×
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{form.skills.length}/20 skills</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
