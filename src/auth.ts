import { useSyncExternalStore } from 'react'

/**
 * Sessão de desbloqueio da senha — em MEMÓRIA apenas (singleton de módulo ES).
 *
 * Recarregar a página (F5/refresh) recria todos os módulos → o estado volta a
 * pedir senha, como se fosse a primeira vez. Nada é gravado em sessionStorage
 * ou localStorage. Compartilhado entre SensitiveData, PasswordGate e Audit,
 * então desbloquear uma vez libera tudo naquela sessão de página.
 */

type Level = 'admin' | 'audit'

const granted: Record<Level, boolean> = { admin: false, audit: false }
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

export function isUnlocked(level: Level = 'admin'): boolean {
  return granted[level] === true
}

export function grant(level: Level = 'admin') {
  if (!granted[level]) { granted[level] = true; emit() }
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
