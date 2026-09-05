export type Role = 'owner' | 'admin' | 'employee' | 'blocked'
export type Permission = 'operate' | 'manage' | 'audit' | 'team' | 'backup'
export const ROLE_LABEL: Record<Role, string> = { owner: 'Dono', admin: 'Administrador', employee: 'Funcionário', blocked: 'Sem acesso' }
export function can(role: Role | null, permission: Permission): boolean {
  if (!role || !['owner', 'admin', 'employee'].includes(role)) return false
  if (permission === 'team') return role === 'owner'
  if (permission === 'operate') return true
  return role === 'owner' || role === 'admin'
}
export function canChangeRole(actor: Role, target: Role, next: Role, self: boolean): boolean {
  return actor === 'owner' && !self && target !== 'owner' && ['admin', 'employee', 'blocked'].includes(next)
}
