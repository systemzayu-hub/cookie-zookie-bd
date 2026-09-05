import type { ReactNode } from 'react'
import { useRole } from '../auth'
import { OwnerKeyLogin } from './OwnerKeyLogin'
export function OwnerAuditGate({ children }: { children: ReactNode }) {
  const role = useRole()
  return role === 'owner' ? <>{children}</> : <OwnerKeyLogin expanded/>
}
