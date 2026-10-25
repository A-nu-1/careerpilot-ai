"use client";

import { useRef, useState } from "react";
import {
  buildJobArchive,
  readJobArchive,
  storageKeys,
  type JobArchive,
} from "@/lib/job-archive";
import type { SavedRealJob } from "@/lib/saved-real-job";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type TrackedRealApplication,
} from "@/lib/tracked-application";

type Props = {
  tracked: TrackedRealApplication[];
  onChange: (
    updater: (current: TrackedRealApplication[]) => TrackedRealApplication[],
  ) => void;
  savedJobs: SavedRealJob[];

  onPrepare: (job: SavedRealJob) => void;
  onFindJobs: () => void;
  onArchiveDelete: (jobId: string) => void;
  onRestoreJob: (job: SavedRealJob) => void;
};

function displayDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleDateString("en-CH");
}

const statusClass: Record<ApplicationStatus, string> = {
  Interested: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  Preparing: "text-purple-300 bg-purple-400/10 border-purple-400/20",
  Applied: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  Interview: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
  Offer: "text-green-300 bg-green-400/10 border-green-400/20",
  Rejected: "text-rose-300 bg-rose-400/10 border-rose-400/20",
  Withdrawn: "text-zinc-300 bg-white/5 border-white/10",
};

export default function ApplicationTracker({
  tracked,
  onChange,
  savedJobs,
  onPrepare,
  onFindJobs,
  onArchiveDelete,
  onRestoreJob,
}: Props) {
  const [filter, setFilter] = useState<"All" | ApplicationStatus>("All");
  const [readyToDelete, setReadyToDelete] = useState<string | null>(null);
  const [archiveMessage, setArchiveMessage] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function exportArchive(item: TrackedRealApplication, job: SavedRealJob) {
    setArchiveError("");
    setArchiveMessage("");
    try {
      const archive = buildJobArchive(job, item);
      const blob = new Blob([JSON.stringify(archive, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = `${job.company}-${job.title}`
        .replace(/[^a-z0-9-]+/gi, "-")
        .slice(0, 70);
      link.href = url;
      link.download = `CareerPilot-${safeName || "application"}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReadyToDelete(item.jobId);
      setArchiveMessage(
        "Archive download initiated. Locate and verify your JSON file before removing browser data.",
      );
    } catch (error) {
      setArchiveError(
        error instanceof Error ? error.message : "Unable to create archive.",
      );
    }
  }

  function deleteAfterArchive(jobId: string) {
    if (readyToDelete !== jobId) return;
    if (
      !window.confirm(
        "Have you verified your downloaded JSON file? This permanently deletes the saved job, tracker entry, career evidence and generated draft from this browser. Continue?",
      )
    )
      return;
    // Deliberately remove all related records only after explicit user confirmation.
    const keys = storageKeys(jobId);
    localStorage.removeItem(keys.evidence);
    localStorage.removeItem(keys.cv);
    localStorage.removeItem(keys.draft);
    onArchiveDelete(jobId);
    setReadyToDelete(null);
    setArchiveMessage(
      "Archived records removed from browser storage. Keep your JSON file safe.",
    );
  }

  async function importArchive(file: File | undefined) {
    if (!file) return;
    setArchiveError("");
    setArchiveMessage("");
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Archive exceeds the 1 MB safety limit.");
      const parsed: JobArchive = readJobArchive(await file.text());
      const existing =
        tracked.some((item) => item.jobId === parsed.job.id) ||
        savedJobs.some((job) => job.id === parsed.job.id);
      if (
        existing &&
        !window.confirm(
          "This job is already in CareerPilot. Restore this archive and overwrite its existing tracking data and drafts?",
        )
      )
        return;
      const keys = storageKeys(parsed.job.id);
      // Store all draft data first; the job and tracker are then updated together.
      // Preflight quota by restoring previous values if a write fails.
      const oldCv = localStorage.getItem(keys.cv);
      const oldEvidence = localStorage.getItem(keys.evidence);
      const oldDraft = localStorage.getItem(keys.draft);
      try {
        if (parsed.cvText !== undefined && parsed.cvText !== null)
          localStorage.setItem(keys.cv, JSON.stringify(parsed.cvText));
        else localStorage.removeItem(keys.cv);
        if (parsed.evidence !== null)
          localStorage.setItem(keys.evidence, JSON.stringify(parsed.evidence));
        else localStorage.removeItem(keys.evidence);
        if (parsed.draft !== null)
          localStorage.setItem(keys.draft, JSON.stringify(parsed.draft));
        else localStorage.removeItem(keys.draft);
      } catch (error) {
        if (oldCv === null) localStorage.removeItem(keys.cv);
        else localStorage.setItem(keys.cv, oldCv);
        if (oldEvidence === null) localStorage.removeItem(keys.evidence);
        else localStorage.setItem(keys.evidence, oldEvidence);
        if (oldDraft === null) localStorage.removeItem(keys.draft);
        else localStorage.setItem(keys.draft, oldDraft);
        throw error;
      }
      onRestoreJob(parsed.job);
      onChange((current) => [
        parsed.tracking,
        ...current.filter((item) => item.jobId !== parsed.job.id),
      ]);
      setArchiveMessage(
        `Restored ${parsed.job.title} at ${parsed.job.company}. Open Preparation to review the recovered draft.`,
      );
      setReadyToDelete(null);
    } catch (error) {
      setArchiveError(
        error instanceof Error ? error.message : "Invalid archive file.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const jobById = new Map(savedJobs.map((job) => [job.id, job]));
  const visible = tracked.filter(
    (item) => filter === "All" || item.status === filter,
  );
  const counts = {
    preparing: tracked.filter((item) => item.status === "Preparing").length,
    applied: tracked.filter((item) => item.status === "Applied").length,
    interview: tracked.filter((item) => item.status === "Interview").length,
    closed: tracked.filter((item) =>
      ["Offer", "Rejected", "Withdrawn"].includes(item.status),
    ).length,
  };

  function update(jobId: string, changes: Partial<TrackedRealApplication>) {
    onChange((current) =>
      current.map((item) =>
        item.jobId === jobId
          ? { ...item, ...changes, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
  }

  function changeStatus(
    item: TrackedRealApplication,
    status: ApplicationStatus,
  ) {
    // Only the user can declare an application submitted.
    update(item.jobId, {
      status,
      appliedAt:
        status === "Applied" && !item.appliedAt
          ? new Date().toISOString()
          : item.appliedAt,
    });
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-purple-400">
          Application Tracking
        </p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          My Applications
        </h1>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Track each real vacancy, record application progress, and reopen the
          saved preparation draft. A status change never submits an application.
        </p>
      </div>

      <div className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Archive & restore</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Export closed applications as JSON, verify the file on your
              laptop, then remove the local copy. Restore here anytime.
            </p>
          </div>
          <label className="cursor-pointer rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2.5 text-sm font-semibold text-purple-200 hover:bg-purple-400/20">
            ↥ Import JSON
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(event) => void importArchive(event.target.files?.[0])}
            />
          </label>
        </div>
        {archiveError && (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {archiveError}
          </p>
        )}
        {archiveMessage && (
          <p role="status" className="mt-3 text-sm text-purple-200">
            {archiveMessage}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Preparing", count: counts.preparing },
          { label: "Applied", count: counts.applied },
          { label: "Interviews", count: counts.interview },
          { label: "Closed outcomes", count: counts.closed },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-[#13131d] p-5"
          >
            <p className="text-sm text-zinc-400">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-white">{item.count}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          {tracked.length} real opportunities tracked in this browser
        </p>
        <select
          aria-label="Filter application status"
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as "All" | ApplicationStatus)
          }
          className="rounded-xl border border-white/10 bg-[#20202e] px-4 py-2.5 text-sm text-white"
        >
          <option value="All">All statuses</option>
          {APPLICATION_STATUSES.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {tracked.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#13131d] p-10 text-center">
          <h2 className="text-xl font-semibold">
            No real applications tracked yet
          </h2>
          <p className="mt-3 text-sm text-zinc-400">
            Save a real job, then choose Track Application or Prepare
            Application.
          </p>
          <button
            type="button"
            onClick={onFindJobs}
            className="mt-5 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold hover:bg-purple-500"
          >
            Find Jobs
          </button>
        </div>
      )}

      <div className="space-y-4">
        {visible.map((item) => {
          const job = jobById.get(item.jobId);
          return (
            <div
              key={item.jobId}
              className="rounded-2xl border border-white/10 bg-[#13131d] p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
                    {job?.company ?? "Job no longer in Saved Jobs"}
                  </p>
                  <h2 className="text-lg font-semibold text-white">
                    {job?.title ?? item.jobId}
                  </h2>
                  {job && (
                    <p className="mt-2 text-sm text-zinc-400">
                      {job.location} · {job.workload}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass[item.status]}`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`status-${item.jobId}`}
                    className="mb-2 block text-sm text-zinc-300"
                  >
                    Application status
                  </label>
                  <select
                    id={`status-${item.jobId}`}
                    value={item.status}
                    onChange={(event) =>
                      changeStatus(
                        item,
                        event.target.value as ApplicationStatus,
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#20202e] px-4 py-3 text-sm text-white"
                  >
                    {APPLICATION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-zinc-400">
                  <p>Tracked: {displayDate(item.createdAt)}</p>
                  <p>Applied: {displayDate(item.appliedAt)}</p>
                  <p>Updated: {displayDate(item.updatedAt)}</p>
                </div>
              </div>

              <label
                htmlFor={`notes-${item.jobId}`}
                className="mt-5 mb-2 block text-sm text-zinc-300"
              >
                Private notes / next steps
              </label>
              <textarea
                id={`notes-${item.jobId}`}
                rows={3}
                maxLength={3000}
                value={item.notes}
                onChange={(event) =>
                  update(item.jobId, { notes: event.target.value })
                }
                placeholder="Recruiter reply, interview date, questions to ask, follow-up…"
                className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none focus:border-purple-500/40"
              />

              <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5">
                {job && (
                  <button
                    type="button"
                    onClick={() => onPrepare(job)}
                    className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500"
                  >
                    ✧ Open Preparation
                  </button>
                )}
                {job?.applyUrl && /^https?:\/\//i.test(job.applyUrl) && (
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white hover:bg-white/5"
                  >
                    View Original ↗
                  </a>
                )}
                {job &&
                  ["Rejected", "Withdrawn", "Offer"].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => exportArchive(item, job)}
                      className="rounded-xl border border-purple-400/30 px-4 py-2.5 text-sm font-semibold text-purple-200 hover:bg-purple-400/10"
                    >
                      ↓ Export Archive
                    </button>
                  )}
                {readyToDelete === item.jobId && (
                  <button
                    type="button"
                    onClick={() => deleteAfterArchive(item.jobId)}
                    className="rounded-xl border border-rose-400/30 px-4 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-400/10"
                  >
                    ✓ Verified file — Remove local data
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove this tracking entry? Saved job and draft will remain available.",
                      )
                    ) {
                      onChange((current) =>
                        current.filter((row) => row.jobId !== item.jobId),
                      );
                    }
                  }}
                  className="rounded-xl border border-rose-400/20 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-400/10"
                >
                  Remove from Tracker
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs leading-6 text-zinc-500">
        Tracking data stays in this browser. Mark Applied only after submitting
        on the employer site. Archive files contain career evidence and draft
        letters: keep them private and back them up.
      </p>
    </div>
  );
}
