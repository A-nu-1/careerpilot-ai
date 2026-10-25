"use client";

import { useState } from "react";
import type { SavedRealJob } from "@/lib/saved-real-job";

type Props = { onSave: (job: SavedRealJob) => void };
export default function PasteJobForm({ onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [workload, setWorkload] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const field =
    "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-purple-400";
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!title.trim() || !company.trim() || description.trim().length < 80) {
      setError(
        "Please enter a job title, employer and a job advert of at least 80 characters.",
      );
      return;
    }
    if (applyUrl.trim() && !/^https?:\/\//i.test(applyUrl.trim())) {
      setError(
        "Application URL must start with https:// or http:// (or leave it empty).",
      );
      return;
    }
    onSave({
      id: `manual:${crypto.randomUUID()}`,
      source: "manual",
      providerId: 0,
      title: title.trim(),
      company: company.trim(),
      location: location.trim() || "Not specified",
      workload: workload.trim() || "Not specified",
      remotePolicy: null,
      description: description.trim(),
      applyUrl: applyUrl.trim(),
      publishedAt: null,
      savedAt: new Date().toISOString(),
    });
    setTitle("");
    setCompany("");
    setLocation("");
    setWorkload("");
    setApplyUrl("");
    setDescription("");
    setOpen(false);
  }
  return (
    <section className="mb-6 rounded-2xl border border-purple-400/25 bg-[#13131d] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Found a job elsewhere?
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Paste any job ad here — no scraping or integration needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500"
        >
          {open ? "Close" : "+ Paste Job Advertisement"}
        </button>
      </div>
      {open && (
        <form onSubmit={save} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-zinc-300">
              Job title *
              <input
                className={`mt-2 ${field}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
            </label>
            <label className="text-sm text-zinc-300">
              Company *
              <input
                className={`mt-2 ${field}`}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={200}
                required
              />
            </label>
            <label className="text-sm text-zinc-300">
              Location
              <input
                className={`mt-2 ${field}`}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={150}
                placeholder="Zürich / Remote"
              />
            </label>
            <label className="text-sm text-zinc-300">
              Workload
              <input
                className={`mt-2 ${field}`}
                value={workload}
                onChange={(e) => setWorkload(e.target.value)}
                maxLength={80}
                placeholder="40–60%"
              />
            </label>
          </div>
          <label className="block text-sm text-zinc-300">
            Original posting / application URL (optional)
            <input
              className={`mt-2 ${field}`}
              type="url"
              value={applyUrl}
              onChange={(e) => setApplyUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Full advertisement *
            <textarea
              className={`mt-2 ${field}`}
              rows={11}
              maxLength={15000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the responsibilities, requirements and company details from the job ad..."
              required
            />
          </label>
          <p className="text-xs text-zinc-500">
            {description.length} / 15,000 characters · Saved in your browser and
            usable with Gemini, tracker, and archives.
          </p>
          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500"
          >
            Save Job & Track
          </button>
        </form>
      )}
    </section>
  );
}
