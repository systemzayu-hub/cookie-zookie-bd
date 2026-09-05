export type Role = 'owner' | 'admin' | 'employee' | 'viewer' | 'blocked'
export type Permission = 'operate' | 'manage' | 'audit' | 'team' | 'backup'
export const ROLE_LABEL: Record<Role, string> = { owner: 'Dono', admin: 'Administrador', employee: 'Funcionário', viewer: 'Sem cargo · somente leitura', blocked: 'Bloqueado' }
export function can(role: Role | null, permission: Permission): boolean {
  if (!role || !['owner', 'admin', 'employee'].includes(role)) return false
  if (permission === 'team' || permission === 'audit') return role === 'owner'
  if (permission === 'operate') return true
  return role === 'owner' || role === 'admin'
}
export function canChangeRole(actor: Role, target: Role, next: Role, self: boolean): boolean {
  return actor === 'owner' && !self && target !== 'owner' && ['admin', 'employee', 'viewer', 'blocked'].includes(next)
}
