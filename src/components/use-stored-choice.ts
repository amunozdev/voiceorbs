'use client';

import { useCallback, useSyncExternalStore } from 'react';

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

const readStored = (key: string): string | null => {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const subscribe = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) memory.clear();
    else memory.delete(event.key);
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
};

export const useStoredChoice = <T extends string>(
  key: string,
  options: readonly T[],
  fallback: T,
): [T, (next: T) => void] => {
  const raw = useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
  const value = raw !== null && (options as readonly string[]).includes(raw) ? (raw as T) : fallback;

  const setValue = useCallback(
    (next: T) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {}
      listeners.forEach((listener) => listener());
    },
    [key],
  );

  return [value, setValue];
};
