export const APPLICATION_STATUSES = [
  "Interested",
  "Preparing",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type TrackedRealApplication = {
  jobId: string;
  status: ApplicationStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
};
