"use client";

import { useEffect, useRef, useState } from "react";

type Backup = {
  format: "careerpilot-full-backup";
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
};

const PREFIX = "careerpilot:";
const MAX_IMPORT_BYTES = 4_500_000;

function capture(): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  }
  return data;
}

function byteSize(text: string) {
  return new Blob([text]).size;
}

function download(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseBackup(text: string): Backup {
  if (byteSize(text) > MAX_IMPORT_BYTES)
    throw new Error("Backup is larger than 4.5 MB.");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Invalid backup file.");
  const backup = parsed as Partial<Backup>;
  if (
    backup.format !== "careerpilot-full-backup" ||
    backup.version !== 1 ||
    typeof backup.exportedAt !== "string" ||
    !backup.data ||
    typeof backup.data !== "object" ||
    Array.isArray(backup.data)
  ) {
    throw new Error("Not a supported CareerPilot full backup.");
  }
  const entries = Object.entries(backup.data);
  if (
    entries.length > 2000 ||
    entries.some(
      ([key, value]) =>
        !key.startsWith(PREFIX) ||
        key.length > 300 ||
        typeof value !== "string" ||
        value.length > 1_500_000,
    )
  ) {
    throw new Error("Backup contains invalid keys or values.");
  }
  // Our persistence layer stores serialized JSON. Reject malformed records before touching storage.
  for (const [, value] of entries) JSON.parse(value);
  return backup as Backup;
}

export default function DataBackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function refreshUsage() {
    const data = capture();
    setUsage({
      count: Object.keys(data).length,
      bytes: byteSize(JSON.stringify(data)),
    });
  }

  useEffect(() => {
    // Measurements run after hydration; the backup panel itself does not persist state.
    const id = window.setTimeout(refreshUsage, 0);
    return () => window.clearTimeout(id);
  }, []);

  function exportAll() {
    setError("");
    setMessage("");
    try {
      const data = capture();
      const archive: Backup = {
        format: "careerpilot-full-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        data,
      };
      const date = new Date().toISOString().slice(0, 10);
      download(
        JSON.stringify(archive, null, 2),
        `CareerPilot-full-backup-${date}.json`,
      );
      setMessage(
        "Download requested. Verify the JSON is saved safely on your laptop.",
      );
      refreshUsage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  }

  async function importAll(file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error("Backup is larger than 4.5 MB.");
      const incoming = parseBackup(await file.text());
      const current = capture();
      const count = Object.keys(incoming.data).length;
      if (
        !window.confirm(
          `Restore ${count} CareerPilot records? This REPLACES your current CareerPilot browser data. Export your current data first if needed.`,
        )
      )
        return;
      const saved = { ...current };
      try {
        Object.keys(current).forEach((key) => localStorage.removeItem(key));
        Object.entries(incoming.data).forEach(([key, value]) =>
          localStorage.setItem(key, value),
        );
      } catch (e) {
        // Attempt to restore existing data on failure (e.g., storage quota).
        try {
          Object.keys(capture()).forEach((key) => localStorage.removeItem(key));
          Object.entries(saved).forEach(([key, value]) =>
            localStorage.setItem(key, value),
          );
        } catch {
          throw new Error(
            "Storage failure; automatic rollback also failed. Restore your previously exported backup.",
          );
        }
        throw e;
      }
      setMessage(
        "Restored successfully. Reloading to load your restored data...",
      );
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      refreshUsage();
    }
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-purple-400/20 bg-purple-500/[0.07] p-4"
      aria-label="CareerPilot backup and storage"
    >
      <div>
        <h3 className="text-base font-semibold text-white">
          Full Backup &amp; Local Storage
        </h3>
        <p className="mt-1 text-sm leading-6 text-zinc-400">
          Export all saved CareerPilot jobs, preferences, career evidence,
          drafts and application tracking into one JSON file. Restore it on
          another browser or after a fresh deployment.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-sm text-zinc-300">
          {usage
            ? `${(usage.bytes / 1024).toFixed(1)} KB · ${usage.count} records`
            : "Calculating local storage..."}
        </p>
        <button
          type="button"
          onClick={refreshUsage}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5"
        >
          Refresh usage
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Size is an approximation based on saved CareerPilot text. Browsers
        usually allow around 5 MiB for localStorage per origin, including other
        app data.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={exportAll}
          className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500"
        >
          Export All Data (JSON)
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-purple-400/40 px-4 py-2.5 text-sm font-semibold text-purple-200 hover:bg-purple-500/10"
        >
          Restore Full Backup
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => void importAll(event.target.files?.[0])}
        />
      </div>
      <p className="text-xs leading-5 text-amber-200/80">
        Backup files contain your CV and application information in plain text.
        Keep them private. No Gemini API key or owner password is included,
        because those are never stored in CareerPilot localStorage.
      </p>
      {message && (
        <p role="status" className="text-sm text-green-300">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
