import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { trackChange } from './undo'
import type { UndoRow, UndoSource } from './undo-model'

export function useTrackedState<T extends UndoRow>(source: UndoSource, initial: () => T[]): [T[], Dispatch<SetStateAction<T[]>>, Dispatch<SetStateAction<T[]>>] {
  const [value, replace] = useState(initial)
  const current = useRef(value)
  current.current = value
  const update = useCallback<Dispatch<SetStateAction<T[]>>>(action => {
    const before = current.current
    const after = typeof action === 'function' ? action(before) : action
    trackChange(source, before, after)
    current.current = after
    replace(after)
  }, [source])
  return [value, update, replace]
}
