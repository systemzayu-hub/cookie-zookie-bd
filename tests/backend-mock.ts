export class HttpsError extends Error { constructor(public code: string, message: string) { super(message) } }
export type CallableRequest = any
export const onCall = (_options: unknown, handler: unknown) => handler
export const initializeApp = () => {}
export const FieldValue = { serverTimestamp: () => 'server-time' }
const data = new Map<string, any>()
let chain = Promise.resolve()
export const fixture = {
  reset() { data.clear(); chain = Promise.resolve() },
  set(path: string, value: any) { data.set(path, structuredClone(value)) },
  get(path: string) { return structuredClone(data.get(path)) },
  list(prefix: string) { return [...data].filter(([path]) => path.startsWith(prefix)).map(([, value]) => structuredClone(value)) },
}
export const getAuth = () => ({ async getUserByEmail(email: string) {
  const user = [...data.values()].find(v => v.email === email && v.uid)
  if (!user) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' })
  return user
} })
export const getFirestore = () => ({
  doc: (path: string) => path,
  runTransaction(handler: (tx: any) => Promise<any>) {
    const job = chain.then(async () => {
      const writes: (() => void)[] = []
      const tx = {
        async get(path: string) {
          if (writes.length) throw new Error('Transaction read after write')
          const value = fixture.get(path)
          return { exists: value !== undefined, data: () => value }
        },
        set(path: string, value: any, options?: any) { writes.push(() => data.set(path, options?.merge ? { ...data.get(path), ...structuredClone(value) } : structuredClone(value))) },
        create(path: string, value: any) { if (data.has(path)) throw new Error('Already exists'); writes.push(() => data.set(path, structuredClone(value))) },
        delete(path: string) { writes.push(() => data.delete(path)) },
      }
      const result = await handler(tx)
      writes.forEach(write => write())
      return result
    })
    chain = job.then(() => {}, () => {})
    return job
  },
})
