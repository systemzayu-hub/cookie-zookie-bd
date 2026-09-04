import { useSyncExternalStore } from 'react'

/** In-memory privacy controls layered on top of the mandatory Google login. */
export type Level = 'admin' | 'audit' | 'financial'

const granted: Record<Level, boolean> = { admin: false, audit: false, financial: false }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

export function isUnlocked(level: Level = 'admin'): boolean {
  return granted[level] === true
}

export function grant(level: Level = 'admin') {
  const levels: Level[] = level === 'audit' ? ['audit'] : ['admin', 'financial']
  let changed = false
  for (const access of levels) {
    if (!granted[access]) { granted[access] = true; changed = true }
  }
  if (changed) emit()
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

const PASSWORD_HASHES: Record<'general' | 'audit', string> = {
  general: 'f9b3042eb718cae745e829174eeb578b36e59a285860d83f699fc547f2f12e86',
  audit: '2e1d2b3621b2511d082ffe8f0ff30ab3001bb55dd0a851e1716dcd920638faf7',
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Audit has its own password; every other protected action shares one password. */
export async function verifyAccessPassword(level: Level, password: string) {
  const passwordKind = level === 'audit' ? 'audit' : 'general'
  if (!password || password.length > 128) return false
  const hashContext = passwordKind === 'audit' ? 'admin' : 'financial'
  const actual = await sha256(`cookie-zookie-v2:${hashContext}:${password}`)
  const expected = PASSWORD_HASHES[passwordKind]
  let different = actual.length ^ expected.length
  for (let index = 0; index < Math.min(actual.length, expected.length); index++) {
    different |= actual.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return different === 0
}
