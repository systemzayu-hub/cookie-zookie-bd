import { useSyncExternalStore } from 'react'
import { can, type Role } from './roles'
export type Level = 'admin' | 'audit' | 'financial'
let role: Role | null = null
const listeners = new Set<() => void>()
export function setRole(next: Role | null) { role = next; listeners.forEach(fn => fn()) }
export function getRole() { return role }
export function revokeAll() { setRole(null) }
export function isUnlocked(level: Level = 'admin') { return can(role, level === 'audit' ? 'audit' : 'manage') }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function useRole() { return useSyncExternalStore(subscribe, getRole, () => null) }
export function useAuth(level: Level = 'admin') { useRole(); return isUnlocked(level) }
