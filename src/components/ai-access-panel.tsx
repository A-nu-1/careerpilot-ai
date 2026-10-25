"use client";
import { useEffect, useState } from "react";
import { getVisitorKey, setVisitorKey } from "@/lib/visitor-key";

export default function AiAccessPanel() {
  const [owner, setOwner] = useState(false);
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        setOwner(d.authenticated === true);
        setEnabled(Boolean(getVisitorKey()));
      })
      .catch(() => {
        setEnabled(Boolean(getVisitorKey()));
      });
  }, []);

  async function login() {
    setWorking(true);
    setMessage("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Sign-in failed.");
      setOwner(true);
      setPassword("");
      setMessage("Owner access active for 7 days in this browser.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setWorking(false);
    }
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOwner(false);
    setMessage("Signed out.");
  }
  return (
    <section className="rounded-2xl border border-purple-400/20 bg-[#171322] p-4 text-sm text-zinc-200">
      <p className="font-semibold text-purple-200">🔐 AI Access</p>
      <p className="mt-1 text-xs leading-5 text-zinc-400">
        Your CV, saved jobs and drafts remain stored only in this browser. AI
        requests require owner access or a visitor-supplied Gemini key.
      </p>
      {owner ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-green-300">
            ✓ Owner signed in — personal server key enabled
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-white/20 px-3 py-2"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Owner password"
            aria-label="Owner password"
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/30 p-2 text-white"
          />
          <button
            type="button"
            disabled={working || !password}
            onClick={() => void login()}
            className="rounded-lg bg-purple-600 px-4 py-2 font-semibold disabled:opacity-50"
          >
            Sign in
          </button>
        </div>
      )}
      {!owner && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Visitor Gemini API key (temporary)"
            aria-label="Visitor Gemini API key"
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/30 p-2 text-white"
          />
          <button
            type="button"
            onClick={() => {
              setVisitorKey(key);
              setKey("");
              setEnabled(Boolean(getVisitorKey()));
              setMessage(
                "Temporary key set in this tab. It will be lost on reload.",
              );
            }}
            className="rounded-lg border border-purple-400/40 px-3 py-2"
          >
            Use my key
          </button>
          {enabled && (
            <button
              type="button"
              onClick={() => {
                setVisitorKey("");
                setEnabled(false);
                setMessage("Temporary key cleared.");
              }}
              className="rounded-lg border border-white/20 px-3 py-2"
            >
              Clear
            </button>
          )}
        </div>
      )}
      {enabled && !owner && (
        <p className="mt-2 text-xs text-green-300">
          ✓ Visitor key active until this page reloads. It is not saved to
          browser storage.
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-xs text-purple-200">
          {message}
        </p>
      )}
    </section>
  );
}
