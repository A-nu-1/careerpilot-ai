"use client";

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type SetStateAction,
} from "react";

const STORAGE_EVENT = "careerpilot:storage";

function readStoredValue(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, (value: SetStateAction<T>) => void] {
  const fallback = useMemo(() => JSON.stringify(initialValue), [initialValue]);

  const subscribe = useCallback(
    (notify: () => void) => {
      const handleChange = (event: Event) => {
        if (event instanceof StorageEvent) {
          if (event.key !== key && event.key !== null) {
            return;
          }
        }

        notify();
      };

      window.addEventListener("storage", handleChange);
      window.addEventListener(STORAGE_EVENT, handleChange);

      return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener(STORAGE_EVENT, handleChange);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(
    () => readStoredValue(key, fallback),
    [key, fallback],
  );

  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const serialized = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const value = useMemo<T>(() => {
    try {
      return JSON.parse(serialized) as T;
    } catch {
      return initialValue;
    }
  }, [serialized, initialValue]);

  const setValue = useCallback(
    (update: SetStateAction<T>) => {
      const currentSerialized = readStoredValue(key, fallback);

      let currentValue: T;

      try {
        currentValue = JSON.parse(currentSerialized) as T;
      } catch {
        currentValue = initialValue;
      }

      const nextValue =
        typeof update === "function"
          ? (update as (previous: T) => T)(currentValue)
          : update;

      try {
        window.localStorage.setItem(key, JSON.stringify(nextValue));

        // Notify components in this same browser tab.
        window.dispatchEvent(new Event(STORAGE_EVENT));
      } catch (error) {
        console.error("Could not save CareerPilot data:", error);
      }
    },
    [key, fallback, initialValue],
  );

  return [value, setValue];
}
