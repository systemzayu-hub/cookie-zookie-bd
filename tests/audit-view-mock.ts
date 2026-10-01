import type { AuditEntryDB, AuditDetails, AuditPage, AuditPageCursor } from '../src/sync'

export const auditUI = {
  load: async (): Promise<AuditEntryDB[]> => [],
  page: async (_cursor?: AuditPageCursor): Promise<AuditPage> => ({ entries: await auditUI.load(), cursor: {} as AuditPageCursor, hasMore: false }),
  details: async (): Promise<AuditDetails> => ({ changes: [] }),
  receive: (_rows: AuditEntryDB[]) => {},
  fail: () => {},
}
export const loadAuditRemote = () => auditUI.load()
export const loadAuditRemotePage = (cursor?: AuditPageCursor) => auditUI.page(cursor)
export const loadAudit = () => []
export const onAuditChanges = (cb: (rows: AuditEntryDB[]) => void, failure?: () => void) => { auditUI.receive = cb; auditUI.fail = failure || (() => {}); return () => {} }
export const callBackend = (name: string) => name === 'auditDetails' ? auditUI.details() : Promise.resolve([])
export const canUndoAction = () => false
export const undoAuditAction = async () => {}
export const auditUndoPatches = () => []
export const previewUndo = () => []
export const undoStatus = () => 'unavailable'
