"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedRealJob } from "@/lib/saved-real-job";

type ProviderJob = {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  applyUrl: string;
  publishedAt: string | null;
};

type JobRecord = {
  jobs: ProviderJob;
  companies?: {
    name?: string;
    remotePolicy?: string | null;
  } | null;
};

type JobResponse = {
  jobs: JobRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Props = {
  onAnalyze: (description: string) => void;
  onSave: (job: SavedRealJob) => void;
  savedJobIds: string[];
  preferredWorkload: string;
  preferredLocations: string;
};

function htmlToText(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");

  document
    .querySelectorAll("script, style, iframe, object, embed")
    .forEach((element) => element.remove());

  document.querySelectorAll("p, li, br, h1, h2, h3, h4").forEach((element) => {
    element.appendChild(document.createTextNode("\n"));
  });

  return (document.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

type WorkloadFit = "good" | "review" | "outside";

type RankedJob = {
  record: JobRecord;
  workloadFit: WorkloadFit;
  locationMatch: boolean;
  workloadLabel: string;
  priority: number;
};

function getPreferredRange(value: string) {
  const numbers = [...value.matchAll(/\d{1,3}/g)]
    .map((match) => Number(match[0]))
    .filter((number) => number > 0 && number <= 100);

  if (numbers.length === 0) {
    return { min: 40, max: 60 };
  }

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
}

function getWorkloadFit(
  job: ProviderJob,
  preferredWorkload: string,
): {
  fit: WorkloadFit;
  label: string;
} {
  const preferred = getPreferredRange(preferredWorkload);

  // Job titles often contain the actual workload,
  // even when the API says only "full-time".
  const match = job.title.match(/(\d{1,3})\s*(?:%?\s*[-–—]\s*(\d{1,3}))?\s*%/);

  if (match) {
    const first = Number(match[1]);
    const second = match[2] ? Number(match[2]) : first;

    const jobMin = Math.min(first, second);
    const jobMax = Math.max(first, second);

    const overlap = jobMax >= preferred.min && jobMin <= preferred.max;

    return {
      fit: overlap ? "good" : "outside",
      label: jobMin === jobMax ? `${jobMin}%` : `${jobMin}–${jobMax}%`,
    };
  }

  // "Part-time" alone doesn't confirm a percentage.
  // "Full-time" alone doesn't necessarily prove
  // whether reduced workload is negotiable.
  return {
    fit: "review",
    label:
      job.type === "part-time"
        ? "Part-time · % unknown"
        : job.type === "full-time"
          ? "Full-time · % unknown"
          : "Workload not specified",
  };
}

function normalizePlace(value: string) {
  return value
    .toLowerCase()
    .replace(/ü/g, "u")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .trim();
}

function matchesPreferredLocation(
  location: string,
  preferredLocations: string,
): boolean {
  const actual = normalizePlace(location);

  const preferred = preferredLocations
    .split(/[,/]/)
    .map(normalizePlace)
    .filter(Boolean);

  return preferred.some((place) => {
    if (place === "remote") {
      // A company-level hybrid policy does not establish
      // that a specific job is remote.
      return false;
    }

    if (place === "aargau") {
      return [
        "aargau",
        "baden",
        "aarau",
        "wettingen",
        "brugg",
        "windisch",
        "magenwil",
        "lenzburg",
        "spreitenbach",
      ].some((city) => actual.includes(city));
    }

    return actual.includes(place);
  });
}

function rankJobs(
  records: JobRecord[],
  preferredWorkload: string,
  preferredLocations: string,
): RankedJob[] {
  return records
    .map((record) => {
      const workload = getWorkloadFit(record.jobs, preferredWorkload);

      const locationMatch = matchesPreferredLocation(
        record.jobs.location ?? "",
        preferredLocations,
      );

      // Explicit workload compatibility gets the
      // greatest priority. Location is secondary.
      const workloadPoints =
        workload.fit === "good" ? 4 : workload.fit === "review" ? 2 : 0;

      return {
        record,
        workloadFit: workload.fit,
        workloadLabel: workload.label,
        locationMatch,
        priority: workloadPoints + (locationMatch ? 1 : 0),
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

export default function RealJobsPanel({
  onAnalyze,
  onSave,
  savedJobIds,
  preferredWorkload,
  preferredLocations,
}: Props) {
  const [input, setInput] = useState("Java");
  const [query, setQuery] = useState("Java");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<JobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fitFilter, setFitFilter] = useState<"all" | WorkloadFit>("all");
  const loadJobs = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
        });

        if (query) params.set("q", query);
        if (type) params.set("type", type);

        const response = await fetch(`/api/jobs/search?${params.toString()}`, {
          signal,
        });

        const result: JobResponse & { error?: string } = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load jobs.");
        }

        if (!Array.isArray(result.jobs) || !result.pagination) {
          throw new Error("Unexpected response from the job API.");
        }

        if (!signal.aborted) setData(result);
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : "Job search failed.");
          setData(null);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [query, type, page],
  );

  useEffect(() => {
    const controller = new AbortController();

    // Start the asynchronous fetch after the effect body.
    // This avoids triggering synchronous state updates
    // inside the effect itself.
    const timeoutId = window.setTimeout(() => {
      void loadJobs(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadJobs]);
  const rankedJobs = data
    ? rankJobs(data.jobs, preferredWorkload, preferredLocations)
    : [];

  const visibleJobs = rankedJobs.filter(
    (item) => fitFilter === "all" || item.workloadFit === fitFilter,
  );

  const goodFitCount = rankedJobs.filter(
    (item) => item.workloadFit === "good",
  ).length;

  const reviewCount = rankedJobs.filter(
    (item) => item.workloadFit === "review",
  ).length;

  const outsideCount = rankedJobs.filter(
    (item) => item.workloadFit === "outside",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple-400">
          Live Job Discovery
        </p>
        <h1 className="text-3xl font-bold text-white">Real Swiss Jobs</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Search real vacancies from Remotli. Open the original listing or send
          its description directly to Gemini for analysis.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(input.trim());
        }}
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#13131d] p-4 sm:flex-row"
      >
        <input
          aria-label="Search real jobs"
          value={input}
          maxLength={100}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Java, React, Support, IT..."
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
        />

        <select
          aria-label="Employment type"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-[#20202e] px-4 py-3 text-sm text-white"
        >
          <option value="">All job types</option>
          <option value="part-time">Part-time</option>
          <option value="full-time">Full-time</option>
          <option value="contract">Contract</option>
          <option value="freelance">Freelance</option>
        </select>

        <button
          type="submit"
          className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500"
        >
          Search Jobs
        </button>
      </form>

      {loading && (
        <p role="status" className="text-sm text-purple-300">
          Searching Swiss job listings...
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Good Workload Fit",
                value: goodFitCount,
                color: "text-emerald-300",
              },
              {
                label: "Worth Checking",
                value: reviewCount,
                color: "text-amber-300",
              },
              {
                label: "Outside Preference",
                value: outsideCount,
                color: "text-zinc-300",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-[#13131d] p-5"
              >
                <p className="text-xs text-zinc-400">{item.label}</p>
                <p className={`mt-3 text-3xl font-bold ${item.color}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">
              Preferred workload:{" "}
              <span className="font-semibold text-purple-300">
                {preferredWorkload}
              </span>
            </p>

            <select
              aria-label="Filter by workload fit"
              value={fitFilter}
              onChange={(event) =>
                setFitFilter(event.target.value as "all" | WorkloadFit)
              }
              className="rounded-xl border border-white/10 bg-[#20202e] px-4 py-3 text-sm text-white"
            >
              <option value="all">All results</option>
              <option value="good">Good workload fit</option>
              <option value="review">Worth checking</option>
              <option value="outside">Outside preference</option>
            </select>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <p className="text-sm text-zinc-400">
              <span className="font-semibold text-white">
                {data.pagination.total}
              </span>{" "}
              jobs found by this provider
            </p>
            <p className="text-sm text-zinc-500">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {visibleJobs.map((ranked) => {
              const record = ranked.record;
              const job = record.jobs;
              const description = htmlToText(job.description ?? "");
              const applyUrl = safeUrl(job.applyUrl);

              const savedId = `remotli:${job.id}`;
              const isSaved = savedJobIds.includes(savedId);

              const realJob: SavedRealJob = {
                id: savedId,
                source: "remotli",
                providerId: job.id,
                title: job.title,
                company: record.companies?.name ?? job.company,
                location: job.location ?? "Not specified",
                workload: ranked.workloadLabel,
                remotePolicy: record.companies?.remotePolicy ?? null,
                description: description.slice(0, 15000),
                applyUrl: applyUrl ?? "",
                publishedAt: job.publishedAt ?? null,
                savedAt: new Date().toISOString(),
              };

              return (
                <div
                  key={job.id}
                  className="flex flex-col rounded-2xl border border-white/10 bg-[#13131d] p-6 transition-colors hover:border-purple-400/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs font-medium text-purple-400">
                        {record.companies?.name ?? job.company}
                      </p>

                      <h2 className="text-lg font-semibold text-white">
                        {job.title}
                      </h2>
                    </div>

                    <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-300">
                      {job.type ?? "Not specified"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">
                    📍 {job.location || "Not specified"}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        ranked.workloadFit === "good"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : ranked.workloadFit === "review"
                            ? "bg-amber-400/10 text-amber-300"
                            : "bg-red-400/10 text-red-300"
                      }`}
                    >
                      {ranked.workloadFit === "good"
                        ? "✓ Good workload fit"
                        : ranked.workloadFit === "review"
                          ? "? Workload to verify"
                          : "✕ Outside workload preference"}
                    </span>

                    <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300">
                      {ranked.workloadLabel}
                    </span>

                    {ranked.locationMatch && (
                      <span className="rounded-lg bg-purple-400/10 px-3 py-1.5 text-xs text-purple-300">
                        ✓ Preferred location
                      </span>
                    )}
                  </div>

                  {record.companies?.remotePolicy && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Company remote policy: {record.companies.remotePolicy}
                    </p>
                  )}

                  {job.publishedAt && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Published: {job.publishedAt.slice(0, 10)}
                    </p>
                  )}

                  <p className="mt-5 line-clamp-4 whitespace-pre-line text-sm leading-7 text-zinc-400">
                    {description || "No description provided."}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-3 border-t border-white/10 pt-5">
                    <button
                      type="button"
                      disabled={isSaved}
                      onClick={() => onSave(realJob)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        isSaved
                          ? "cursor-default border-pink-400/30 bg-pink-400/10 text-pink-300"
                          : "border-white/15 text-white hover:border-purple-400/40 hover:bg-purple-500/10"
                      }`}
                    >
                      {isSaved ? "♥ Saved" : "♡ Save Job"}
                    </button>

                    {applyUrl && (
                      <a
                        href={applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5"
                      >
                        View Original ↗
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={description.length < 80}
                      onClick={() => onAnalyze(description.slice(0, 15000))}
                      className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
                    >
                      ✧ Analyse with Gemini
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleJobs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
              No jobs match this filter on the current page. Try another filter
              or search keyword.
            </div>
          )}

          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm disabled:opacity-30"
            >
              ← Previous
            </button>

            <span className="text-sm text-zinc-400">
              {page} / {data.pagination.totalPages || 1}
            </span>

            <button
              type="button"
              disabled={loading || page >= data.pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm disabled:opacity-30"
            >
              Next →
            </button>
          </div>

          <p className="text-xs leading-6 text-zinc-500">
            Source: Remotli. Job details and availability may change. Verify the
            original employer listing before applying.
          </p>
        </>
      )}
    </div>
  );
}
