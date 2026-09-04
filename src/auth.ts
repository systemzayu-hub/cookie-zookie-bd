import { useSyncExternalStore } from 'react'

/** In-memory privacy controls for a Google-authenticated session. */
export type Level = 'admin' | 'audit'

const granted: Record<Level, boolean> = { admin: false, audit: false }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

export function isUnlocked(level: Level = 'admin'): boolean {
  return granted[level] === true
}

export function grant(level: Level = 'admin') {
  if (!granted[level]) { granted[level] = true; emit() }
}

export function revoke(level: Level = 'admin') {
  if (granted[level]) { granted[level] = false; emit() }
}

export function revokeAll() {
  let changed = false
  for (const level of Object.keys(granted) as Level[]) {
    if (granted[level]) { granted[level] = false; changed = true }
  }
  if (changed) emit()
}

const subscribe = (callback: () => void) => {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function useAuth(level: Level = 'admin'): boolean {
  return useSyncExternalStore(subscribe, () => granted[level])
}
