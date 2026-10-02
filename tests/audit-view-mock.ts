import type { AuditEntryDB, AuditDetails, AuditPage, AuditPageCursor } from '../src/sync'

export const auditUI = {
  load: async (): Promise<AuditEntryDB[]> => [],
  page: async (_cursor?: AuditPageCursor): Promise<AuditPage> => ({ entries: await auditUI.load(), cursor: {} as AuditPageCursor, hasMore: false }),
  details: async (): Promise<AuditDetails> => ({ changes: [] }),
  receive: (_rows: AuditEntryDB[]) => {},
  fail: () => {},
}
export const auditBackend = {
  previewUndo: async (): Promise<{ source: string; count: number }[]> => [],
  undoAction: async (): Promise<void> => {},
}
export const loadAuditRemote = () => auditUI.load()
export const loadAuditRemotePage = (cursor?: AuditPageCursor) => auditUI.page(cursor)
export const loadAudit = () => []
export const onAuditChanges = (cb: (rows: AuditEntryDB[]) => void, failure?: () => void) => { auditUI.receive = cb; auditUI.fail = failure || (() => {}); return () => {} }
export const callBackend = (name: string) => {
  if (name === 'auditDetails') return auditUI.details()
  if (name === 'previewUndo') return auditBackend.previewUndo()
  if (name === 'undoAction') return auditBackend.undoAction()
  return Promise.resolve([])
}
export const canUndoAction = () => false
export const undoAuditAction = async () => {}
export const auditUndoPatches = () => []
export const previewUndo = () => []
export const undoStatus = () => 'unavailable'
