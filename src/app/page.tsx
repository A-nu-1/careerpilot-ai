"use client";

import { useState } from "react";
import {
  candidateProfile,
  type CandidateProfile,
} from "@/lib/candidate-profile";
import { matchJob, type MatchResult } from "@/lib/job-matcher";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  assessLanguages,
  calculateAssessmentCoverage,
} from "@/lib/language-matcher";
import RealJobsPanel from "@/components/real-jobs-panel";
import type { SavedRealJob } from "@/lib/saved-real-job";
import ApplicationPreparation from "@/components/application-preparation";
import ApplicationTracker from "@/components/application-tracker";
import PasteJobForm from "@/components/paste-job-form";
import AiAccessPanel from "@/components/ai-access-panel";
import DataBackupPanel from "@/components/data-backup-panel";
import { aiRequestHeaders } from "@/lib/visitor-key";
import type { TrackedRealApplication } from "@/lib/tracked-application";

type Section =
  | "dashboard"
  | "find"
  | "saved"
  | "prepare"
  | "applications"
  | "assistant"
  | "settings";

type JobAnalysis = {
  title: string;
  company: string;
  location: string;
  workload: string;
  employmentType: string;
  requiredSkills: string[];
  preferredSkills: string[];
  languages: string[];
  requiredLanguages: string[];
  preferredLanguages: string[];
  responsibilities: string[];
  experienceRequirements: string[];
  summary: string;
  notes: string[];
};
type AiJobMatch = {
  result: MatchResult;
  profileSnapshot: CandidateProfile;
};

const navItems: {
  id: Section;
  label: string;
  icon: string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: "◫" },
  { id: "find", label: "Find Jobs", icon: "⌕" },
  { id: "saved", label: "Saved Jobs", icon: "♡" },
  { id: "applications", label: "Applications", icon: "▤" },
  { id: "assistant", label: "AI Assistant", icon: "✧" },
  { id: "settings", label: "Preferences", icon: "⚙" },
];

const initialPreferences = {
  location: candidateProfile.preferredLocations.join(", "),
  workload: `${candidateProfile.minimumWorkload}–${candidateProfile.maximumWorkload}%`,
  skills: candidateProfile.skills.join(", "),
  language: candidateProfile.languages
    .map((item) => `${item.name} (${item.level})`)
    .join(", "),
  roles: "Java, Application Support, Full-Stack, Integration, IT",
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-purple-400">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  detail,
}: {
  title: string;
  value: string | number;
  icon: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#13131d] p-5 transition-colors hover:border-purple-500/30">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-zinc-400">{title}</p>
        <span className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-xl text-purple-300">
          {icon}
        </span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

export default function Home() {
  const [section, setSection] = useState<Section>("dashboard");
  const [preparingJob, setPreparingJob] = useState<SavedRealJob | null>(null);
  const [careerEvidence, setCareerEvidence] = usePersistentState<string>(
    "careerpilot:career-evidence",
    "",
  );
  const [trackedRealApplications, setTrackedRealApplications] =
    usePersistentState<TrackedRealApplication[]>(
      "careerpilot:tracked-real-applications",
      [],
    );

  const [jobDescription, setJobDescription] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<JobAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiJobMatch, setAiJobMatch] = useState<AiJobMatch | null>(null);

  async function analyzeJob() {
    if (aiLoading) return;

    const description = jobDescription.trim();

    if (description.length < 80 || description.length > 15000) {
      setAiError(
        "Please enter a job description between 80 and 15,000 characters.",
      );
      setAiAnalysis(null);
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiAnalysis(null);
    setAiJobMatch(null);

    try {
      const response = await fetch("/api/ai/analyze-job", {
        method: "POST",
        headers: aiRequestHeaders(),
        body: JSON.stringify({ description }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Job analysis failed.");
      }

      setAiAnalysis(data.analysis as JobAnalysis);
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  function calculateAiJobMatch() {
    if (!aiAnalysis) return;

    const extractedJob = {
      title: aiAnalysis.title,
      location: aiAnalysis.location,
      workload: aiAnalysis.workload,

      // Employment type and remote work are not always the
      // same thing. Use only explicit remote information.
      type: /\bremote\b/i.test(aiAnalysis.employmentType)
        ? "Remote"
        : aiAnalysis.employmentType,

      // Required skills determine the current skill score.
      skills: aiAnalysis.requiredSkills,
      missing: [] as string[],
    };

    const result = matchJob(extractedJob, activeProfile);

    setAiJobMatch({
      result,
      profileSnapshot: {
        ...activeProfile,
        skills: [...activeProfile.skills],
        preferredLocations: [...activeProfile.preferredLocations],
      },
    });
  }

  function addMissingSkill(skill: string) {
    const normalizedSkill = skill.trim();

    if (!normalizedSkill || !aiAnalysis) return;

    const existingSkills = preferences.skills
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const alreadyExists = existingSkills.some(
      (item) => item.toLowerCase() === normalizedSkill.toLowerCase(),
    );

    const updatedSkills = alreadyExists
      ? existingSkills
      : [...existingSkills, normalizedSkill];

    // Save to Preferences (and localStorage).
    setPreferences((current) => ({
      ...current,
      skills: updatedSkills.join(", "),
    }));

    // Recalculate immediately using the updated profile.
    const updatedProfile: CandidateProfile = {
      ...activeProfile,
      skills: updatedSkills,
    };

    const extractedJob = {
      title: aiAnalysis.title,
      location: aiAnalysis.location,
      workload: aiAnalysis.workload,
      type: /\bremote\b/i.test(aiAnalysis.employmentType)
        ? "Remote"
        : aiAnalysis.employmentType,
      skills: aiAnalysis.requiredSkills,
      missing: [] as string[],
    };

    setAiJobMatch({
      result: matchJob(extractedJob, updatedProfile),
      profileSnapshot: updatedProfile,
    });
  }

  const [mobileMenu, setMobileMenu] = useState(false);
  const [savedRealJobs, setSavedRealJobs] = usePersistentState<SavedRealJob[]>(
    "careerpilot:real-saved-jobs",
    [],
  );
  const [preferences, setPreferences] = usePersistentState(
    "careerpilot:preferences",
    initialPreferences,
  );

  // Convert editable preferences into the active candidate profile.
  const locations = preferences.location
    .split(/[,/]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const skills = preferences.skills
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const workloadValues = [...preferences.workload.matchAll(/\d{1,3}/g)].map(
    (match) => Number(match[0]),
  );

  const validWorkload =
    workloadValues.length > 0 &&
    workloadValues.length <= 2 &&
    workloadValues.every((value) => value >= 1 && value <= 100);

  const activeProfile: CandidateProfile = {
    ...candidateProfile,
    languages: preferences.language
      .split(",")
      .map((entry) => {
        const match = entry.trim().match(/^(.+?)\s*\((.+)\)$/);

        return match
          ? { name: match[1].trim(), level: match[2].trim() }
          : { name: entry.trim(), level: "Not specified" };
      })
      .filter((item) => item.name.length > 0),
    skills,
    preferredLocations: locations,
    minimumWorkload: validWorkload
      ? Math.min(...workloadValues)
      : candidateProfile.minimumWorkload,
    maximumWorkload: validWorkload
      ? Math.max(...workloadValues)
      : candidateProfile.maximumWorkload,
  };

  // Recalculate whenever the candidate profile changes.
  // Always match against the ORIGINAL job requirements.
  function saveRealJob(job: SavedRealJob) {
    setSavedRealJobs((current) => {
      if (current.some((item) => item.id === job.id)) {
        return current;
      }

      return [job, ...current];
    });
  }

  function trackRealJob(
    job: SavedRealJob,
    status: TrackedRealApplication["status"] = "Interested",
  ) {
    setTrackedRealApplications((current) => {
      if (current.some((item) => item.jobId === job.id)) return current;
      const now = new Date().toISOString();
      return [
        {
          jobId: job.id,
          status,
          notes: "",
          createdAt: now,
          updatedAt: now,
          appliedAt: null,
        },
        ...current,
      ];
    });
  }

  function openRealJobPreparation(job: SavedRealJob) {
    trackRealJob(job, "Preparing");
    setPreparingJob(job);
    navigate("prepare");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeRealJob(id: string) {
    setSavedRealJobs((current) => current.filter((job) => job.id !== id));
  }

  function analyzeRealJob(description: string) {
    setJobDescription(description);
    setAiAnalysis(null);
    setAiJobMatch(null);
    setAiError("");
    navigate("assistant");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function navigate(nextSection: Section) {
    setSection(nextSection);
    setMobileMenu(false);
  }

  const nav = (
    <nav className="space-y-1.5">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => navigate(item.id)}
          aria-current={section === item.id ? "page" : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
            section === item.id
              ? "bg-purple-600/20 text-purple-300"
              : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <span className="w-6 text-center text-xl">{item.icon}</span>
          {item.label}

          {item.id === "saved" && savedRealJobs.length > 0 && (
            <span className="ml-auto rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
              {savedRealJobs.length}
            </span>
          )}
        </button>
      ))}
    </nav>
  );

  const aiLanguageChecks =
    aiAnalysis && aiJobMatch
      ? assessLanguages(
          aiAnalysis.requiredLanguages,
          aiAnalysis.preferredLanguages,
          aiJobMatch.profileSnapshot,
        )
      : [];

  const aiAssessmentCoverage =
    aiAnalysis && aiJobMatch
      ? calculateAssessmentCoverage({
          hasSkills: aiAnalysis.requiredSkills.length > 0,
          hasWorkload: !aiJobMatch.result.unknownFactors.includes("Workload"),
          hasLocation: !aiJobMatch.result.unknownFactors.includes("Location"),
          hasLanguageInformation:
            aiAnalysis.requiredLanguages.length > 0 ||
            aiAnalysis.preferredLanguages.length > 0,
        })
      : null;

  return (
    <div className="min-h-screen bg-[#09090f] text-white">
      <div className="flex min-h-screen">
        {/* DESKTOP SIDEBAR */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[#101018] p-5 lg:flex">
          <div className="mb-12 flex items-center gap-3 px-2 pt-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 text-xl font-bold text-white">
              ✦
            </div>
            <div>
              <p className="font-bold tracking-tight">CareerPilot</p>
              <p className="text-xs text-purple-400">AI Job Assistant</p>
            </div>
          </div>

          <p className="mb-4 px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            Workspace
          </p>

          {nav}

          <div className="mt-auto rounded-2xl border border-purple-400/10 bg-purple-500/[0.06] p-4">
            <p className="text-sm font-semibold text-white">✧ AI matching</p>
            <p className="mt-2 text-xs leading-6 text-zinc-400">
              Paste a vacancy, prepare your application, and track your
              progress.
            </p>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="min-w-0 flex-1">
          {/* TOP BAR */}
          <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-white/10 bg-[#09090f]/95 px-5 backdrop-blur sm:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenu(true)}
                aria-label="Open navigation"
                className="rounded-lg border border-white/10 px-3 py-2 text-lg lg:hidden"
              >
                ☰
              </button>

              <div>
                <p className="text-sm font-semibold text-white">
                  CareerPilot AI
                </p>
                <p className="text-xs text-zinc-500">
                  Your career, intelligently guided.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 sm:inline-flex">
                ● Local-first Workspace
              </span>

              <div className="flex size-10 items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/15 text-sm font-bold text-purple-300">
                AR
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
            <div className="mb-5">
              <AiAccessPanel />
            </div>
            {/* DASHBOARD */}
            {section === "dashboard" && (
              <>
                <SectionHeading
                  eyebrow="Overview"
                  title="Your Career Dashboard"
                  description="Discover opportunities, review potential matches and organise your job search in one place."
                />

                <div className="mb-8 rounded-2xl border border-purple-400/20 bg-gradient-to-r from-purple-500/15 via-pink-500/[0.06] to-transparent p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
                        Welcome to CareerPilot
                      </p>
                      <h2 className="text-2xl font-bold text-white">
                        Find your next opportunity.
                      </h2>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
                        Save vacancies from Swiss job boards or paste any job
                        advertisement to prepare a tailored application.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate("find")}
                      className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
                    >
                      Explore Jobs →
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Jobs Found"
                    value={savedRealJobs.length}
                    icon="⌕"
                    detail="Saved opportunities"
                  />
                  <StatCard
                    title="Interviews"
                    value={
                      trackedRealApplications.filter(
                        (item) => item.status === "Interview",
                      ).length
                    }
                    icon="✧"
                    detail="Tracked interviews"
                  />
                  <StatCard
                    title="Saved Jobs"
                    value={savedRealJobs.length}
                    icon="♡"
                    detail="Saved in this browser"
                  />
                  <StatCard
                    title="Applications"
                    value={trackedRealApplications.length}
                    icon="▤"
                    detail="Tracked applications"
                  />
                </div>

                <div className="mb-5 mt-12 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">Recommended for you</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Your saved opportunities
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("find")}
                    className="text-sm font-semibold text-purple-400 hover:text-purple-300"
                  >
                    View all jobs →
                  </button>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  {savedRealJobs.slice(0, 4).map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-white/10 bg-[#13131d] p-5"
                    >
                      <p className="text-xs font-semibold text-purple-300">
                        {job.company}
                      </p>
                      <h3 className="mt-2 font-semibold">{job.title}</h3>
                      <p className="mt-2 text-sm text-zinc-400">
                        {job.location} · {job.workload}
                      </p>
                      <button
                        type="button"
                        onClick={() => openRealJobPreparation(job)}
                        className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
                      >
                        Prepare application
                      </button>
                    </div>
                  ))}
                  {savedRealJobs.length === 0 && (
                    <p className="text-sm text-zinc-400">
                      No saved jobs yet. Paste or find your first vacancy.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* FIND JOBS */}
            {section === "find" && (
              <>
                <PasteJobForm
                  onSave={(job) => {
                    saveRealJob(job);
                    trackRealJob(job);
                    navigate("saved");
                  }}
                />
                <RealJobsPanel
                  preferredWorkload={preferences.workload}
                  preferredLocations={preferences.location}
                  savedJobIds={savedRealJobs.map((job) => job.id)}
                  onSave={saveRealJob}
                  onAnalyze={analyzeRealJob}
                />
              </>
            )}

            {/* SAVED JOBS */}
            {section === "saved" && (
              <>
                <SectionHeading
                  eyebrow="Your Shortlist"
                  title="Saved Jobs"
                  description="Keep interesting opportunities in one place for further review."
                />

                {savedRealJobs.length > 0 ? (
                  <div className="grid gap-5 xl:grid-cols-2">
                    {savedRealJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex flex-col rounded-2xl border border-purple-400/20 bg-[#13131d] p-6 transition-colors hover:border-purple-400/40"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="mb-2 text-xs font-medium text-purple-400">
                              {job.company}
                            </p>
                            <h3 className="text-lg font-semibold text-white">
                              {job.title}
                            </h3>
                            <p className="mt-3 text-sm text-zinc-400">
                              {job.location} · {job.workload}
                            </p>
                          </div>
                          <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs font-medium text-purple-200">
                            {trackedRealApplications.find(
                              (item) => item.jobId === job.id,
                            )?.status ?? "Interested"}
                          </span>
                        </div>

                        <p className="mt-4 line-clamp-4 whitespace-pre-line text-sm leading-7 text-zinc-400">
                          {job.description || "No description available."}
                        </p>
                        <p className="mt-4 text-xs text-zinc-500">
                          Saved{" "}
                          {new Date(job.savedAt).toLocaleDateString("en-CH")}
                        </p>

                        <div className="mt-auto flex flex-wrap gap-3 border-t border-white/10 pt-5">
                          <button
                            type="button"
                            onClick={() => removeRealJob(job.id)}
                            className="rounded-xl border border-pink-400/20 px-4 py-2.5 text-sm text-pink-300 hover:bg-pink-400/10"
                          >
                            ♥ Remove
                          </button>

                          {/^https?:\/\//i.test(job.applyUrl) && (
                            <a
                              href={job.applyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5"
                            >
                              View Original ↗
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              trackRealJob(job);
                              navigate("applications");
                            }}
                            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5"
                          >
                            {trackedRealApplications.some(
                              (item) => item.jobId === job.id,
                            )
                              ? "✓ Tracked"
                              : "+ Track Application"}
                          </button>

                          <button
                            type="button"
                            disabled={job.description.trim().length < 80}
                            onClick={() => openRealJobPreparation(job)}
                            className="rounded-xl border border-purple-400/30 bg-purple-500/10 px-4 py-2.5 text-sm font-semibold text-purple-200 hover:bg-purple-500/20 disabled:opacity-40"
                          >
                            ✧ Prepare Application
                          </button>

                          <button
                            type="button"
                            disabled={job.description.trim().length < 80}
                            onClick={() => analyzeRealJob(job.description)}
                            className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
                          >
                            ✧ Analyse with Gemini
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-[#13131d] p-12 text-center">
                    <p className="mb-3 text-4xl">♡</p>
                    <h2 className="text-xl font-semibold">No saved jobs yet</h2>
                    <p className="mt-3 text-sm text-zinc-400">
                      Save real vacancies from Find Jobs to see them here.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("find")}
                      className="mt-6 rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold hover:bg-purple-500"
                    >
                      Browse Jobs
                    </button>
                  </div>
                )}
              </>
            )}

            {/* APPLICATION PREPARATION */}
            {section === "prepare" && preparingJob && (
              <ApplicationPreparation
                key={preparingJob.id}
                job={preparingJob}
                profile={activeProfile}
                careerEvidence={careerEvidence}
                onBack={() => navigate("saved")}
                onTrack={() => {
                  trackRealJob(preparingJob, "Preparing");
                  navigate("applications");
                }}
              />
            )}

            {/* APPLICATIONS */}
            {section === "applications" && (
              <ApplicationTracker
                tracked={trackedRealApplications}
                onChange={setTrackedRealApplications}
                savedJobs={savedRealJobs}
                onPrepare={openRealJobPreparation}
                onFindJobs={() => navigate("find")}
                onArchiveDelete={(jobId) => {
                  setTrackedRealApplications((current) =>
                    current.filter((item) => item.jobId !== jobId),
                  );
                  setSavedRealJobs((current) =>
                    current.filter((job) => job.id !== jobId),
                  );
                  if (preparingJob?.id === jobId) setPreparingJob(null);
                }}
                onRestoreJob={(job) => {
                  setSavedRealJobs((current) =>
                    current.some((item) => item.id === job.id)
                      ? current
                      : [job, ...current],
                  );
                }}
              />
            )}

            {/* AI ASSISTANT */}
            {section === "assistant" && (
              <>
                <SectionHeading
                  eyebrow="Powered by Gemini"
                  title="AI Job Analyser"
                  description="Paste a job description and let Gemini extract the requirements, responsibilities and important details."
                />

                <div className="space-y-6">
                  {/* INPUT */}
                  <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-[#13131d] p-6 sm:p-8">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-500/15 text-3xl text-purple-300">
                        ✧
                      </div>

                      <div>
                        <h2 className="text-xl font-bold text-white">
                          Analyse a Job
                        </h2>
                        <p className="mt-1 text-xs text-zinc-400">
                          Gemini 3.5 Flash-Lite · AI-powered extraction
                        </p>
                      </div>
                    </div>

                    <label
                      htmlFor="job-description"
                      className="mb-3 block text-sm font-semibold text-zinc-300"
                    >
                      Job Description
                    </label>

                    <textarea
                      id="job-description"
                      value={jobDescription}
                      onChange={(event) => {
                        setJobDescription(event.target.value);
                        setAiAnalysis(null);
                        setAiJobMatch(null);
                        setAiError("");
                      }}
                      maxLength={15000}
                      rows={12}
                      placeholder="Paste the job advertisement here..."
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-5 py-4 text-sm leading-7 text-white outline-none placeholder:text-zinc-600 focus:border-purple-500/50"
                    />

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-zinc-500">
                        {jobDescription.length.toLocaleString()} / 15,000
                        characters
                      </p>

                      <button
                        type="button"
                        disabled={
                          aiLoading || jobDescription.trim().length < 80
                        }
                        onClick={analyzeJob}
                        className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {aiLoading
                          ? "✧ Gemini is analysing..."
                          : "✧ Analyse with Gemini"}
                      </button>
                    </div>

                    {aiError && (
                      <div
                        role="alert"
                        className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
                      >
                        {aiError}
                      </div>
                    )}

                    {aiLoading && (
                      <div
                        role="status"
                        className="mt-5 rounded-xl border border-purple-400/20 bg-purple-500/10 p-4 text-sm text-purple-200"
                      >
                        Reading the job description and extracting
                        requirements...
                      </div>
                    )}
                  </div>

                  {/* AI RESULTS */}
                  {aiAnalysis && (
                    <div className="space-y-6 rounded-2xl border border-white/10 bg-[#13131d] p-6 sm:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple-400">
                            Gemini Analysis
                          </p>

                          <h2 className="text-2xl font-bold text-white">
                            {aiAnalysis.title}
                          </h2>

                          <p className="mt-2 text-sm text-zinc-400">
                            {aiAnalysis.company}
                          </p>
                        </div>

                        <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-300">
                          ✧ AI Analysed
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          ["Location", aiAnalysis.location],
                          ["Workload", aiAnalysis.workload],
                          ["Employment", aiAnalysis.employmentType],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                          >
                            <p className="text-xs text-zinc-500">{label}</p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div>
                        <h3 className="mb-3 font-semibold text-purple-300">
                          ✧ Job Summary
                        </h3>

                        <p className="text-sm leading-8 text-zinc-300">
                          {aiAnalysis.summary}
                        </p>
                      </div>

                      {(
                        [
                          {
                            title: "Required Skills",
                            values: aiAnalysis.requiredSkills,
                            color: "bg-emerald-400/10 text-emerald-300",
                          },
                          {
                            title: "Preferred Skills",
                            values: aiAnalysis.preferredSkills,
                            color: "bg-purple-400/10 text-purple-300",
                          },
                          {
                            title: "Languages",
                            values: aiAnalysis.languages,
                            color: "bg-sky-400/10 text-sky-300",
                          },
                        ] as const
                      ).map((group) => (
                        <div key={group.title}>
                          <h3 className="mb-3 font-semibold text-white">
                            {group.title}
                          </h3>

                          {group.values.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {group.values.map((item, index) => (
                                <span
                                  key={`${item}-${index}`}
                                  className={`rounded-lg px-3 py-2 text-xs ${group.color}`}
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-500">
                              Not specified in the posting.
                            </p>
                          )}
                        </div>
                      ))}

                      {(
                        [
                          {
                            title: "Responsibilities",
                            values: aiAnalysis.responsibilities,
                          },
                          {
                            title: "Experience Requirements",
                            values: aiAnalysis.experienceRequirements,
                          },
                          {
                            title: "Important Notes",
                            values: aiAnalysis.notes,
                          },
                        ] as const
                      ).map((group) => (
                        <div key={group.title}>
                          <h3 className="mb-3 font-semibold text-white">
                            {group.title}
                          </h3>

                          {group.values.length > 0 ? (
                            <ul className="space-y-2 text-sm leading-7 text-zinc-400">
                              {group.values.map((item, index) => (
                                <li
                                  key={`${item}-${index}`}
                                  className="flex gap-3"
                                >
                                  <span className="text-purple-400">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-zinc-500">
                              Not specified in the posting.
                            </p>
                          )}
                        </div>
                      ))}

                      {/* PERSONAL JOB MATCHING */}
                      <div className="rounded-2xl border border-purple-400/25 bg-gradient-to-br from-purple-500/15 via-[#171723] to-[#101018] p-6 sm:p-8">
                        <div className="flex flex-wrap items-start justify-between gap-5">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple-400">
                              ✧ CareerPilot Matching Engine
                            </p>

                            <h3 className="text-2xl font-bold text-white">
                              How well does this job match you?
                            </h3>

                            <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
                              Compare Gemini&apos;s extracted requirements with
                              your saved skills, workload and location
                              preferences.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={calculateAiJobMatch}
                            className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
                          >
                            ✧{" "}
                            {aiJobMatch
                              ? "Recalculate Match"
                              : "Calculate My Match"}
                          </button>
                        </div>

                        {aiJobMatch && (
                          <div className="mt-7 space-y-6 border-t border-white/10 pt-7">
                            <div className="flex flex-wrap items-center gap-6">
                              <div className="flex size-28 shrink-0 flex-col items-center justify-center rounded-full border-4 border-purple-500 bg-purple-500/10">
                                <span className="text-4xl font-bold text-white">
                                  {aiJobMatch.result.score}%
                                </span>
                                <span className="text-[10px] text-purple-300">
                                  Rule-based fit
                                </span>
                              </div>

                              <div>
                                <h4 className="text-xl font-bold text-white">
                                  {aiJobMatch.result.score >= 85
                                    ? "Strong potential match"
                                    : aiJobMatch.result.score >= 65
                                      ? "Promising match"
                                      : aiJobMatch.result.score >= 40
                                        ? "Partial match"
                                        : "Needs further review"}
                                </h4>

                                <p className="mt-2 max-w-md text-sm leading-7 text-zinc-400">
                                  Calculated using the profile saved in
                                  CareerPilot, not a score invented by Gemini.
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              {[
                                {
                                  label: "Skills",
                                  score: aiJobMatch.result.skillScore,
                                  weight: "75% weight",
                                },
                                {
                                  label: "Workload",
                                  score: aiJobMatch.result.workloadScore,
                                  weight: "15% weight",
                                },
                                {
                                  label: "Location",
                                  score: aiJobMatch.result.locationScore,
                                  weight: "10% weight",
                                },
                              ].map((item) => (
                                <div
                                  key={item.label}
                                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm text-zinc-400">
                                      {item.label}
                                    </p>
                                    <span className="text-xs text-zinc-500">
                                      {item.weight}
                                    </span>
                                  </div>

                                  <p className="mt-3 text-2xl font-bold text-white">
                                    {aiJobMatch.result.unknownFactors.includes(
                                      item.label,
                                    )
                                      ? "Unknown"
                                      : `${item.score}%`}
                                  </p>

                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className="h-full rounded-full bg-purple-500"
                                      style={{ width: `${item.score}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="grid gap-5 md:grid-cols-2">
                              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-5">
                                <h4 className="mb-4 font-semibold text-emerald-300">
                                  ✓ Matching Required Skills
                                </h4>

                                {aiJobMatch.result.matchedSkills.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {aiJobMatch.result.matchedSkills.map(
                                      (skill) => (
                                        <span
                                          key={skill}
                                          className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300"
                                        >
                                          {skill}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-zinc-400">
                                    No exact skill matches identified.
                                  </p>
                                )}
                              </div>

                              <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-5">
                                <h4 className="mb-4 font-semibold text-amber-300">
                                  ! Requirements to Verify
                                </h4>

                                {aiJobMatch.result.missingSkills.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {aiJobMatch.result.missingSkills.map(
                                      (skill) => (
                                        <div
                                          key={skill}
                                          className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 py-1.5 pl-3 pr-1.5"
                                        >
                                          <span className="text-xs text-amber-300">
                                            {skill}
                                          </span>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              addMissingSkill(skill)
                                            }
                                            title={`Add ${skill} to my skills`}
                                            aria-label={`Add ${skill} to my skills`}
                                            className="flex size-7 items-center justify-center rounded-md bg-amber-400/15 text-lg font-bold text-amber-200 transition-colors hover:bg-emerald-500/20 hover:text-emerald-300"
                                          >
                                            +
                                          </button>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-zinc-400">
                                    No exact required-skill gaps identified.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* LANGUAGE ASSESSMENT */}
                            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                              <h4 className="mb-4 font-semibold text-purple-300">
                                ✧ Language Compatibility
                              </h4>

                              {aiLanguageChecks.length === 0 ? (
                                <p className="text-sm text-zinc-400">
                                  No explicit language requirements were
                                  extracted.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {aiLanguageChecks.map((check, index) => (
                                    <div
                                      key={`${check.requirement}-${index}`}
                                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/10 p-4"
                                    >
                                      <div className="flex-1">
                                        <p className="text-sm font-semibold text-white">
                                          {check.requirement}
                                        </p>

                                        <p className="mt-1 text-xs text-zinc-500">
                                          {check.required
                                            ? "Required"
                                            : "Preferred"}
                                        </p>

                                        <p className="mt-2 text-xs leading-6 text-zinc-400">
                                          {check.explanation}
                                        </p>
                                      </div>

                                      <span
                                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                                          check.status === "met"
                                            ? "bg-emerald-400/10 text-emerald-300"
                                            : check.status === "not-met"
                                              ? "bg-red-400/10 text-red-300"
                                              : "bg-amber-400/10 text-amber-300"
                                        }`}
                                      >
                                        {check.status === "met"
                                          ? "✓ Meets"
                                          : check.status === "not-met"
                                            ? "✕ Gap"
                                            : "! Verify"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* ASSESSMENT COVERAGE */}
                            {aiAssessmentCoverage && (
                              <div className="rounded-xl border border-purple-400/20 bg-purple-500/[0.06] p-5">
                                <div className="flex items-center justify-between gap-3">
                                  <h4 className="font-semibold text-purple-300">
                                    Assessment Coverage
                                  </h4>

                                  <span className="text-2xl font-bold text-white">
                                    {aiAssessmentCoverage.percentage}%
                                  </span>
                                </div>

                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full bg-purple-500"
                                    style={{
                                      width: `${aiAssessmentCoverage.percentage}%`,
                                    }}
                                  />
                                </div>

                                <p className="mt-4 text-sm leading-7 text-zinc-400">
                                  Information available for{" "}
                                  {aiAssessmentCoverage.available.length} of 4
                                  assessment categories.
                                </p>

                                {aiAssessmentCoverage.unknown.length > 0 && (
                                  <p className="mt-2 text-xs leading-6 text-amber-300">
                                    Missing information:{" "}
                                    {aiAssessmentCoverage.unknown.join(", ")}.
                                  </p>
                                )}

                                <p className="mt-3 text-xs leading-6 text-zinc-500">
                                  Coverage measures information availability,
                                  not the probability of being hired.
                                  Experience, salary and qualifications are not
                                  yet included.
                                </p>
                              </div>
                            )}

                            <div className="rounded-xl border border-purple-400/20 bg-purple-500/[0.06] p-5">
                              <h4 className="mb-3 font-semibold text-purple-300">
                                ✧ Why this job matches
                              </h4>

                              <p className="text-sm leading-8 text-zinc-300">
                                {aiJobMatch.result.explanation}
                              </p>
                            </div>

                            <p className="text-xs leading-6 text-zinc-500">
                              Calculated using a profile containing{" "}
                              {aiJobMatch.profileSnapshot.skills.length} skills.
                              If you change Preferences, click Recalculate Match
                              to use the updated profile.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-200">
                        AI-generated extraction and experimental rule-based
                        scoring. Verify requirements against the original
                        advertisement. Unknown workload or location currently
                        scores zero for that category, and skill matching
                        requires exact names. Language requirements, preferred
                        skills and experience levels are not yet scored.
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* PREFERENCES */}
            {section === "settings" && (
              <>
                <SectionHeading
                  eyebrow="Your Profile"
                  title="Job Preferences"
                  description="Personalise your profile and watch CareerPilot recalculate your job matches automatically."
                />

                <div className="max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#13131d] p-6 sm:p-8">
                  <div className="rounded-xl border border-purple-400/20 bg-purple-500/[0.07] p-4">
                    <p className="text-sm font-semibold text-purple-300">
                      ✧ Live Matching Enabled
                    </p>

                    <p className="mt-2 text-xs leading-6 text-zinc-400">
                      Updating your skills, workload or location automatically
                      recalculates your job match scores. No save button
                      required.
                    </p>
                  </div>

                  {(
                    [
                      ["location", "Preferred locations"],
                      ["workload", "Preferred workload"],
                      ["skills", "Your technical skills"],
                      ["language", "Working languages"],
                      ["roles", "Target roles"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label
                        htmlFor={key}
                        className="mb-2 block text-sm font-medium text-zinc-300"
                      >
                        {label}
                      </label>

                      {key === "skills" ? (
                        <textarea
                          id={key}
                          rows={5}
                          value={preferences.skills}
                          onChange={(event) =>
                            setPreferences((current) => ({
                              ...current,
                              skills: event.target.value,
                            }))
                          }
                          placeholder="Java, SQL, React, Next.js..."
                          className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none focus:border-purple-500/50"
                        />
                      ) : (
                        <input
                          id={key}
                          type="text"
                          value={preferences[key]}
                          onChange={(event) =>
                            setPreferences((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50"
                        />
                      )}

                      {key === "location" && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Separate locations with commas. Example: Aargau,
                          Zürich, Baden, Remote
                        </p>
                      )}

                      {key === "workload" && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Example: 40–60% or 60%. Invalid entries use the
                          default workload.
                        </p>
                      )}

                      {key === "skills" && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Separate skills with commas. Matching is currently
                          based on exact skill names.
                        </p>
                      )}

                      {(key === "language" || key === "roles") && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Editable profile information. Scoring integration
                          coming later.
                        </p>
                      )}
                    </div>
                  ))}

                  <div className="rounded-xl border border-purple-400/20 bg-purple-500/5 p-5">
                    <label
                      htmlFor="master-career-evidence"
                      className="block text-lg font-semibold text-white"
                    >
                      Master career profile / confirmed experience
                    </label>
                    <p className="mt-2 text-sm text-zinc-400">
                      Write your accurate work history, education,
                      qualifications and project experience once. New job
                      applications start with these details, and you can still
                      edit each application individually. Do not enter secrets.
                    </p>
                    <textarea
                      id="master-career-evidence"
                      value={careerEvidence}
                      onChange={(event) =>
                        setCareerEvidence(event.target.value)
                      }
                      maxLength={7000}
                      rows={12}
                      placeholder="Your real professional experience, dates, project work, education and qualifications..."
                      className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none focus:border-purple-500/50"
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                      Saved in your browser automatically ·{" "}
                      {careerEvidence.length} / 7000 characters
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = savedRealJobs
                          .map((job) => {
                            try {
                              return JSON.parse(
                                localStorage.getItem(
                                  `careerpilot:application-evidence:${job.id}`,
                                ) || "null",
                              );
                            } catch {
                              return null;
                            }
                          })
                          .find(
                            (value): value is string =>
                              typeof value === "string" &&
                              value.trim().length > 40,
                          );
                        if (!existing) {
                          window.alert(
                            "No saved job-specific career evidence was found. You can paste your verified profile above.",
                          );
                          return;
                        }
                        if (
                          careerEvidence.trim() &&
                          !window.confirm(
                            "Replace your current master career profile with the evidence from a saved application?",
                          )
                        )
                          return;
                        setCareerEvidence(existing);
                      }}
                      className="mt-3 rounded-lg border border-purple-400/30 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-500/10"
                    >
                      Import evidence from an existing prepared job
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Current matching profile
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {activeProfile.skills.length} skills ·{" "}
                        {activeProfile.minimumWorkload}–
                        {activeProfile.maximumWorkload}% workload
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreferences(initialPreferences)}
                      className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <p className="text-xs leading-6 text-zinc-500">
                    Profile and preferences save automatically in this browser.
                    Export a backup before clearing site data.
                  </p>
                  <DataBackupPanel />
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* MOBILE NAVIGATION */}
      {mobileMenu && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileMenu(false)}
            className="absolute inset-0 bg-black/75"
          />

          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-[#101018] p-5">
            <div className="mb-8 flex items-center justify-between">
              <p className="text-lg font-bold text-white">✦ CareerPilot AI</p>
              <button
                type="button"
                onClick={() => setMobileMenu(false)}
                aria-label="Close navigation"
                className="rounded-lg border border-white/10 px-3 py-2 text-zinc-300"
              >
                ✕
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      {/* MATCH DETAILS MODAL */}
    </div>
  );
}
