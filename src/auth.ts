import { useSyncExternalStore } from 'react'

/**
 * Sessão de desbloqueio da senha — em MEMÓRIA apenas (singleton de módulo ES).
 *
 * Recarregar a página (F5/refresh) recria todos os módulos → o estado volta a
 * pedir senha, como se fosse a primeira vez. Nada é gravado em sessionStorage
 * ou localStorage. Compartilhado entre SensitiveData, PasswordGate e Audit,
 * então desbloquear uma vez libera tudo naquela sessão de página.
 */

export type Level = 'admin' | 'audit'

/** Hashes das senhas — nunca em texto plano */
export const HASHES: Record<Level, string> = {
  admin: '70e58a3aeb9d8ade3ca32d518e28de7f9c889b50b82c667d344eb062234f6215',  // CookiZo0406 (edição)
  audit: '231d78fc9347664084c7c3baca4ef2273df8791b9c33c028fe6527ae8f52b41a',   // CoZooAdm0406 (auditoria/faturamento) — mesmo hash de audit.ts
}

const granted: Record<Level, boolean> = { admin: false, audit: false }
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

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
  for (const k of (Object.keys(granted) as Level[])) if (granted[k]) { granted[k] = false; changed = true }
  if (changed) emit()
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb) }

/** Hook reativo: true se a senha daquele nível já foi liberada nesta página */
export function useAuth(level: Level = 'admin'): boolean {
  return useSyncExternalStore(subscribe, () => granted[level])
}

/* ---------- RATE LIMIT de senha (brute-force) ---------- */

const RATE_LIMIT_KEY = 'lock_fail'
const RATE_LIMIT_LOCK_KEY = 'lock_until'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutos

function readAttempts(): number {
  if (typeof window === 'undefined') return 0
  const raw = sessionStorage.getItem(RATE_LIMIT_KEY)
  return raw ? parseInt(raw, 10) : 0
}

function writeAttempts(n: number) {
  if (typeof window === 'undefined') return
  if (n <= 0) sessionStorage.removeItem(RATE_LIMIT_KEY)
  else sessionStorage.setItem(RATE_LIMIT_KEY, String(n))
}

function readLockUntil(): number {
  if (typeof window === 'undefined') return 0
  const raw = sessionStorage.getItem(RATE_LIMIT_LOCK_KEY)
  return raw ? parseInt(raw, 10) : 0
}

function writeLockUntil(ts: number) {
  if (typeof window === 'undefined') return
  if (ts <= 0) sessionStorage.removeItem(RATE_LIMIT_LOCK_KEY)
  else sessionStorage.setItem(RATE_LIMIT_LOCK_KEY, String(ts))
}

export function isRateLimited(): boolean {
  const until = readLockUntil()
  return until > Date.now()
}

export function getRateLimitRemainingMs(): number {
  const until = readLockUntil()
  return Math.max(0, until - Date.now())
}

export function recordFailedAttempt(): number {
  if (isRateLimited()) return getRateLimitRemainingMs()
  const next = readAttempts() + 1
  writeAttempts(next)
  if (next >= MAX_ATTEMPTS) {
    const until = Date.now() + LOCKOUT_MS
    writeLockUntil(until)
    writeAttempts(0)
    return LOCKOUT_MS
  }
  return 0
}

export function recordSuccessfulAttempt() {
  writeAttempts(0)
  writeLockUntil(0)
}

/** Retorna { locked: boolean, remainingMs: number } para UI */
export function getRateLimitState(): { locked: boolean; remainingMs: number } {
  return { locked: isRateLimited(), remainingMs: getRateLimitRemainingMs() }
}