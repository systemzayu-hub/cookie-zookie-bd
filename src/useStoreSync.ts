import { useEffect, useRef, useState } from 'react'
import { load, save } from './data'
import { onRemoteChanges, syncCommit } from './sync'
import { mergeStore, sameData, SyncConflict } from './store-merge'
import { validateStoreData, type StoreData } from './validation'

type Pending = { owner: string; base: StoreData; local: StoreData }
export function useStoreSync(owner: string | null, data: StoreData, apply: (data: StoreData) => void, online: boolean) {
  const [status, setStatus] = useState<'offline' | 'syncing' | 'synced' | 'error' | 'conflict'>('offline')
  const [ready, setReady] = useState(false)
  const [attempt, retry] = useState(0)
  const [connection, reconnect] = useState(0)
  const current = useRef(data), applyRef = useRef(apply)
  current.current = data; applyRef.current = apply
  const base = useRef<StoreData | null>(null)
  const pending = useRef(false), busy = useRef(false), conflict = useRef(false)
  const generation = useRef(0)
  const missedSnapshot = useRef(false)
  const applied = useRef<StoreData | null>(null)

  const persist = () => {
    if (owner && base.current) save('cc_sync_pending', { owner, base: base.current, local: current.current })
  }
  const receive = (value: StoreData) => {
    applied.current = value; current.current = value; applyRef.current(value)
  }

  useEffect(() => {
    generation.current++
    base.current = null; pending.current = false; busy.current = false; conflict.current = false
    setReady(false)
    if (!owner) { setStatus('offline'); return }
    const saved = load<Pending | null>('cc_sync_pending', null)
    if (saved?.owner === owner && validateStoreData(saved.base) && validateStoreData(saved.local)) {
      base.current = saved.base
      pending.current = !sameData(saved.base, saved.local)
      receive(saved.local)
      setReady(true)
    }
    setStatus(navigator.onLine ? 'syncing' : 'offline')
    const stop = onRemoteChanges(remote => {
      if (busy.current) { missedSnapshot.current = true; return }
      if (conflict.current) return
      try {
        const local = base.current && (pending.current || !sameData(base.current, current.current))
          ? mergeStore(base.current, current.current, remote) : remote
        base.current = remote
        pending.current = !sameData(local, remote)
        receive(local); persist(); setReady(true)
        setStatus(pending.current ? 'syncing' : 'synced')
        if (pending.current) retry(value => value + 1)
      } catch {
        conflict.current = true; persist(); setStatus('conflict'); setReady(true)
      }
    }, () => setStatus(navigator.onLine ? 'error' : 'offline'))
    return () => { generation.current++; stop() }
  }, [owner, connection])

  useEffect(() => {
    if (!owner || !base.current || !ready) return
    if (applied.current && sameData(applied.current, data)) { applied.current = null }
    pending.current = !sameData(base.current, current.current)
    persist()
    if (conflict.current) return
    if (!pending.current) return
    if (!online) { setStatus('offline'); return }
    if (busy.current) return
    setStatus('syncing')
    const timer = window.setTimeout(() => {
      if (conflict.current || busy.current || !navigator.onLine) return
      const sent = current.current, previous = base.current!, session = generation.current
      busy.current = true
      void syncCommit(previous, sent).then(merged => {
        if (session !== generation.current) return
        const next = mergeStore(sent, current.current, merged)
        base.current = merged; receive(next)
        pending.current = !sameData(next, merged); persist()
        setStatus(pending.current ? 'syncing' : 'synced')
      }).catch(error => {
        if (session !== generation.current) return
        conflict.current = error instanceof SyncConflict
        persist(); setStatus(conflict.current ? 'conflict' : navigator.onLine ? 'error' : 'offline')
      }).finally(() => {
        if (session !== generation.current) return
        busy.current = false
        if (base.current !== previous && missedSnapshot.current) {
          missedSnapshot.current = false
          reconnect(value => value + 1)
          return
        }
        // Only schedule the next write when new edits arrived during a successful write.
        if (!conflict.current && base.current !== previous && pending.current) retry(value => value + 1)
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [data.products, data.sales, data.customers, owner, online, ready, attempt])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!pending.current && !busy.current) return
      event.preventDefault(); event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  return { status, ready, retry: () => reconnect(value => value + 1), discardPending: () => {
    if (!save('cc_sync_pending', null)) return false
    pending.current = false
    return true
  } }
}
