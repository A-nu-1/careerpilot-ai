import type { SavedRealJob } from "@/lib/saved-real-job";
import {
  APPLICATION_STATUSES,
  type TrackedRealApplication,
} from "@/lib/tracked-application";

export type JobArchive = {
  format: "careerpilot-job-archive";
  version: 1;
  exportedAt: string;
  job: SavedRealJob;
  tracking: TrackedRealApplication;
  evidence: string | null;
  cvText?: string | null;
  draft: {
    cvSuggestions: string[];
    motivationLetter: string;
    verificationQuestions: string[];
    cautions: string[];
  } | null;
};

export function storageKeys(jobId: string) {
  return {
    cv: `careerpilot:application-cv:${jobId}`,
    evidence: `careerpilot:application-evidence:${jobId}`,
    draft: `careerpilot:application-draft:${jobId}`,
  };
}

export function buildJobArchive(
  job: SavedRealJob,
  tracking: TrackedRealApplication,
): JobArchive {
  if (tracking.jobId !== job.id)
    throw new Error("Tracking entry does not match job.");
  const keys = storageKeys(job.id);
  const cvRaw = localStorage.getItem(keys.cv);
  const cvText: unknown = cvRaw === null ? null : JSON.parse(cvRaw);
  const evidenceRaw = localStorage.getItem(keys.evidence);
  const draftRaw = localStorage.getItem(keys.draft);
  const evidence: unknown =
    evidenceRaw === null ? null : JSON.parse(evidenceRaw);
  const draft: unknown = draftRaw === null ? null : JSON.parse(draftRaw);
  return readJobArchive(
    JSON.stringify({
      format: "careerpilot-job-archive",
      version: 1,
      exportedAt: new Date().toISOString(),
      job,
      tracking,
      evidence,
      draft,
      cvText,
    }),
  );
}

export function readJobArchive(raw: string): JobArchive {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid archive structure.");
  const archive = data as Partial<JobArchive>;
  if (
    archive.format !== "careerpilot-job-archive" ||
    archive.version !== 1 ||
    typeof archive.exportedAt !== "string"
  )
    throw new Error("Unsupported CareerPilot archive format/version.");
  const job = archive.job;
  const tracking = archive.tracking;
  if (
    !job ||
    typeof job !== "object" ||
    typeof job.id !== "string" ||
    !(job.id.startsWith("remotli:") || job.id.startsWith("manual:")) ||
    !Number.isFinite(job.providerId) ||
    (job.source !== "remotli" && job.source !== "manual") ||
    ![
      job.title,
      job.company,
      job.location,
      job.workload,
      job.description,
      job.applyUrl,
      job.savedAt,
    ].every((value) => typeof value === "string") ||
    (job.remotePolicy !== null && typeof job.remotePolicy !== "string") ||
    (job.publishedAt !== null && typeof job.publishedAt !== "string")
  )
    throw new Error("Archive has invalid saved job data.");
  if (
    !tracking ||
    tracking.jobId !== job.id ||
    !APPLICATION_STATUSES.includes(tracking.status) ||
    typeof tracking.notes !== "string" ||
    typeof tracking.createdAt !== "string" ||
    typeof tracking.updatedAt !== "string" ||
    (tracking.appliedAt !== null && typeof tracking.appliedAt !== "string")
  )
    throw new Error("Archive has invalid tracking data.");
  if (
    archive.cvText !== undefined &&
    archive.cvText !== null &&
    typeof archive.cvText !== "string"
  )
    throw new Error("Archive has invalid CV text.");
  if (archive.evidence !== null && typeof archive.evidence !== "string")
    throw new Error("Archive has invalid career evidence.");
  if (archive.draft !== null) {
    const draft = archive.draft;
    if (
      !draft ||
      typeof draft !== "object" ||
      !Array.isArray(draft.cvSuggestions) ||
      !Array.isArray(draft.verificationQuestions) ||
      !Array.isArray(draft.cautions) ||
      ![
        ...draft.cvSuggestions,
        ...draft.verificationQuestions,
        ...draft.cautions,
      ].every((value) => typeof value === "string") ||
      typeof draft.motivationLetter !== "string"
    )
      throw new Error("Archive has invalid preparation draft.");
  }
  return archive as JobArchive;
}
