export type SavedRealJob = {
  id: string;
  source: "remotli" | "manual";
  providerId: number;
  title: string;
  company: string;
  location: string;
  workload: string;
  remotePolicy: string | null;
  description: string;
  applyUrl: string;
  publishedAt: string | null;
  savedAt: string;
};
