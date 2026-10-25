"use client";
// Intentionally kept only in JavaScript memory. Never write API keys to localStorage.
let temporaryKey = "";
export function getVisitorKey() {
  return temporaryKey;
}
export function setVisitorKey(value: string) {
  temporaryKey = value.trim();
}
export function aiRequestHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(temporaryKey ? { "x-careerpilot-gemini-key": temporaryKey } : {}),
  };
}
