"use client";

import { useState } from "react";
import type { CandidateProfile } from "@/lib/candidate-profile";
import type { SavedRealJob } from "@/lib/saved-real-job";
import { usePersistentState } from "@/hooks/usePersistentState";
import { printApplicationPdf } from "@/lib/print-application";
import { aiRequestHeaders } from "@/lib/visitor-key";

type Draft = {
  cvSuggestions: string[];
  motivationLetter: string;
  cvText?: string;
  verificationQuestions: string[];
  cautions: string[];
};

type AgentResult = {
  draft: Draft;
  fit: {
    summary: string;
    strengths: string[];
    gaps: string[];
    questions: string[];
  };
  trace: { tool: string; outcome: string }[];
};

type Props = {
  job: SavedRealJob;
  profile: CandidateProfile;
  careerEvidence: string;
  onBack: () => void;
  onTrack: () => void;
};

export default function ApplicationPreparation({
  job,
  profile,
  careerEvidence,
  onBack,
  onTrack,
}: Props) {
  const [evidence, setEvidence] = usePersistentState<string>(
    `careerpilot:application-evidence:${job.id}`,
    "",
  );
  const [cvText, setCvText] = usePersistentState<string>(
    `careerpilot:application-cv:${job.id}`,
    "",
  );
  const [draft, setDraft] = usePersistentState<Draft | null>(
    `careerpilot:application-draft:${job.id}`,
    null,
  );
  const [outputLanguage, setOutputLanguage] = usePersistentState<
    "English" | "German"
  >(`careerpilot:application-language:${job.id}`, "English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);

  async function generateDraft() {
    if (loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/ai/prepare-application", {
        method: "POST",
        headers: aiRequestHeaders(),
        body: JSON.stringify({
          job: {
            title: job.title,
            company: job.company,
            description: job.description,
          },
          evidence: evidence || careerEvidence,
          skills: profile.skills,
          languages: profile.languages.map(
            (item) => `${item.name} (${item.level})`,
          ),
          outputLanguage,
        }),
      });
      const result: { success?: boolean; draft?: Draft; error?: string } =
        await response.json();
      if (!response.ok || !result.success || !result.draft) {
        throw new Error(result.error ?? "Unable to generate a draft.");
      }
      const generatedCv = result.draft.cvText?.trim();
      if (generatedCv) {
        // Never silently replace a CV the user has already edited.
        const existingIsEvidence =
          !cvText.trim() ||
          cvText.trim() === (careerEvidence || evidence).trim();
        if (
          existingIsEvidence ||
          window.confirm(
            "Replace the existing CV text with the newly generated " +
              outputLanguage +
              " CV? Any previous edits will be overwritten.",
          )
        ) {
          setCvText(generatedCv);
        }
      }
      setDraft(result.draft);
      setNotice(
        "CV and motivation letter generated in " +
          outputLanguage +
          ". Check all details before applying.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to prepare application.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function runAgent() {
    if (agentLoading || loading) return;
    setError("");
    setNotice("");
    setAgentResult(null);
    setAgentLoading(true);
    try {
      const response = await fetch("/api/ai/agent", {
        method: "POST",
        headers: aiRequestHeaders(),
        body: JSON.stringify({
          job: {
            title: job.title,
            company: job.company,
            description: job.description,
          },
          evidence: evidence || careerEvidence,
          skills: profile.skills,
          languages: profile.languages.map((x) => `${x.name} (${x.level})`),
          outputLanguage,
        }),
      });
      const result: AgentResult & { success?: boolean; error?: string } =
        await response.json();
      if (!response.ok || !result.success || !result.draft)
        throw new Error(result.error || "Agent failed.");
      setAgentResult(result);
      setNotice(
        "The agent finished. Review its work below, then approve before saving.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent failed.");
    } finally {
      setAgentLoading(false);
    }
  }

  function acceptAgentDraft() {
    if (!agentResult) return;
    if (
      (draft || cvText.trim()) &&
      !window.confirm(
        "Replace your saved CV and letter with the agent drafts? Existing edits will be overwritten.",
      )
    )
      return;
    setDraft(agentResult.draft);
    setCvText(agentResult.draft.cvText ?? "");
    setAgentResult(null);
    setNotice(
      "Approved! The new CV and motivation letter are now saved in this browser.",
    );
  }

  async function copyLetter() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.motivationLetter);
      setNotice("Motivation letter copied.");
    } catch {
      setError(
        "Copy did not work. Select the letter text and copy it manually.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-purple-400">
            ✧ Application Preparation
          </p>
          <h1 className="text-3xl font-bold text-white">
            Prepare your application
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            {job.title} · {job.company} · {job.location}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTrack}
            className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500"
          >
            ▤ View in Tracker
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/5"
          >
            ← Saved Jobs
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm leading-7 text-amber-100">
        Gemini will only use the evidence you provide. Enter genuine work
        history and project achievements; do not add skills you cannot
        substantiate. Drafting does not send an application to the employer.
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#13131d] p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">
          1. Your confirmed experience
        </h2>
        <p className="mt-2 text-sm leading-7 text-purple-300">
          Prefilled from your saved master career profile in Preferences. Edits
          here affect only this job.
        </p>
        <p className="mt-2 text-sm leading-7 text-zinc-400">
          Include your real positions, responsibilities, technologies you
          actually used, dates if known, and which modern projects were personal
          or client work. The stored skills list alone is not proof of
          professional expertise.
        </p>
        <label
          htmlFor="career-evidence"
          className="mt-5 block text-sm font-semibold text-zinc-200"
        >
          Career evidence (required)
        </label>
        <textarea
          id="career-evidence"
          rows={9}
          maxLength={7000}
          value={evidence || careerEvidence}
          onChange={(event) => setEvidence(event.target.value)}
          placeholder="Example structure: Professional experience: ...\nPersonal/client projects: ...\nVerified achievements: ...\nEducation/certificates: ..."
          className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none focus:border-purple-500/50"
        />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <label
              htmlFor="letter-language"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Application language (CV + letter)
            </label>
            <select
              id="letter-language"
              value={outputLanguage}
              onChange={(event) =>
                setOutputLanguage(event.target.value as "English" | "German")
              }
              className="rounded-xl border border-white/10 bg-[#20202e] px-4 py-3 text-sm text-white"
            >
              <option value="English">English</option>
              <option value="German">German</option>
            </select>
          </div>
          <button
            type="button"
            disabled={
              loading ||
              (evidence || careerEvidence).trim().length < 40 ||
              job.description.trim().length < 80
            }
            onClick={() => void generateDraft()}
            className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading
              ? "✧ Preparing..."
              : draft
                ? "✧ Regenerate Draft"
                : "✧ Generate Application Draft"}
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-purple-400/30 bg-purple-500/5 p-4">
          <p className="text-sm font-semibold text-purple-200">
            🤖 CareerPilot Agent · autonomous tool calling
          </p>
          <p className="mt-1 text-xs leading-6 text-zinc-400">
            Gemini chooses tools to inspect your profile, evaluate job fit and
            prepare a complete draft. Nothing is saved or replaced until you
            approve.
          </p>
          <button
            type="button"
            onClick={() => void runAgent()}
            disabled={
              agentLoading ||
              loading ||
              (evidence || careerEvidence).trim().length < 40 ||
              job.description.trim().length < 80
            }
            className="mt-3 rounded-xl border border-purple-400/40 px-5 py-2.5 text-sm font-semibold text-purple-100 hover:bg-purple-600/20 disabled:opacity-40"
          >
            {agentLoading ? "Agent working…" : "🤖 Run Application Agent"}
          </button>
        </div>
        {agentResult && (
          <div className="mt-5 space-y-4 rounded-xl border border-purple-400/30 bg-[#1c172a] p-5">
            <h3 className="text-lg font-semibold text-purple-100">
              Agent review — not saved yet
            </h3>
            <ol className="space-y-2 text-sm text-zinc-300">
              {agentResult.trace.map((t, i) => (
                <li key={i}>
                  <span className="font-semibold text-purple-300">
                    {i + 1}. {t.tool.replaceAll("_", " ")}
                  </span>{" "}
                  — {t.outcome}
                </li>
              ))}
            </ol>
            <p className="text-sm text-zinc-200">{agentResult.fit.summary}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-green-300">
                  Strengths
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs leading-6 text-zinc-300">
                  {agentResult.fit.strengths.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  Gaps / risks
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs leading-6 text-zinc-300">
                  {agentResult.fit.gaps.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <details className="rounded-lg border border-white/10 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-white">
                Preview CV generated by agent
              </summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-6 text-zinc-300">
                {agentResult.draft.cvText}
              </pre>
            </details>
            <details className="rounded-lg border border-white/10 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-white">
                Preview motivation letter
              </summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-6 text-zinc-300">
                {agentResult.draft.motivationLetter}
              </pre>
            </details>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={acceptAgentDraft}
                className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500"
              >
                Approve &amp; Save Drafts
              </button>
              <button
                type="button"
                onClick={() => setAgentResult(null)}
                className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-zinc-200 hover:bg-white/5"
              >
                Discard agent results
              </button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          {(evidence || careerEvidence).length} / 7,000 characters. Your
          reusable profile lives in Preferences; changes here are job-specific.
          Gemini receives the evidence and job description when you generate.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 text-sm text-purple-200"
          >
            {notice}
          </p>
        )}
      </div>

      {draft && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#13131d] p-6 sm:p-8">
            <h2 className="text-xl font-semibold">
              2. CV tailoring suggestions
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Apply only changes that your existing CV and confirmed experience
              support.
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-zinc-300">
              {draft.cvSuggestions.map((item, index) => (
                <li className="flex gap-3" key={index}>
                  <span className="text-purple-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#13131d] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">
                3. Editable CV for this application
              </h2>
              <button
                type="button"
                disabled={!(cvText || careerEvidence || evidence).trim()}
                onClick={() => {
                  try {
                    printApplicationPdf(
                      `CV - ${job.title} - ${job.company}`,
                      cvText || draft.cvText || careerEvidence || evidence,
                      "cv",
                      outputLanguage,
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Unable to print CV.",
                    );
                  }
                }}
                className="rounded-xl border border-purple-400/30 px-4 py-2 text-sm text-purple-200 hover:bg-purple-500/10 disabled:opacity-40"
              >
                Download CV as PDF ↗
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Gemini drafts this CV in your selected language, using only
              confirmed facts. Add or correct your name, contact details, dates
              and education as needed. You can edit everything before printing.
            </p>
            <textarea
              aria-label="Edit tailored CV"
              rows={17}
              maxLength={15000}
              value={cvText || draft.cvText || careerEvidence || evidence}
              onChange={(event) => setCvText(event.target.value)}
              className="mt-5 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-zinc-200 outline-none focus:border-purple-500/50"
            />
            <p className="mt-2 text-xs text-zinc-500">
              PDF uses a clean A4 CV layout. In the print dialog choose “Save as
              PDF” and turn off browser headers/footers. Edits are saved per
              vacancy.
            </p>
          </div>
          <div className="rounded-2xl border border-purple-400/20 bg-[#13131d] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                4. Editable motivation letter
              </h2>
              <button
                type="button"
                onClick={() => {
                  try {
                    printApplicationPdf(
                      `Motivation Letter - ${job.title} - ${job.company}`,
                      draft.motivationLetter,
                      "letter",
                      outputLanguage,
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Unable to print letter.",
                    );
                  }
                }}
                className="rounded-xl border border-purple-400/30 px-4 py-2 text-sm text-purple-200 hover:bg-purple-500/10"
              >
                Download Letter as PDF ↗
              </button>
              <button
                type="button"
                onClick={() => void copyLetter()}
                className="rounded-xl border border-purple-400/30 px-4 py-2 text-sm text-purple-200 hover:bg-purple-500/10"
              >
                Copy letter
              </button>
            </div>
            <textarea
              aria-label="Edit generated motivation letter"
              rows={18}
              value={draft.motivationLetter}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, motivationLetter: event.target.value }
                    : current,
                )
              }
              className="mt-5 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-zinc-200 outline-none focus:border-purple-500/50"
            />
            <p className="mt-3 text-xs text-zinc-500">
              Edits save in this browser. Verify claims and adjust the tone
              before use.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6">
              <h2 className="font-semibold text-amber-300">
                5. Things to verify
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-300">
                {draft.verificationQuestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#13131d] p-6">
              <h2 className="font-semibold text-purple-300">
                Requirements or fit concerns
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-300">
                {draft.cautions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {/***** This opens the application, it never submits it. *****/}
            {/^https?:\/\//i.test(job.applyUrl) && (
              <a
                href={job.applyUrl}
                rel="noopener noreferrer"
                target="_blank"
                className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-500"
              >
                Open Employer Application ↗
              </a>
            )}
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium hover:bg-white/5"
            >
              Return to Saved Jobs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
