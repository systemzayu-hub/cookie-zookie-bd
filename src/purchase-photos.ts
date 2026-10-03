type PhotoIndex = Record<string, string>

export async function commitPurchasePhotos(previous: PhotoIndex, next: PhotoIndex, save: (photos: PhotoIndex) => Promise<unknown>, commit: () => Promise<unknown>, setCurrent: (photos: PhotoIndex) => void): Promise<boolean> {
  // Keep old attachments available until the remote change is confirmed.
  const staged = { ...previous, ...next }
  await save(staged)
  setCurrent(staged)
  try {
    await commit()
  } catch (error) {
    // Imports can confirm some new purchases before a later chunk fails.
    const recovered = { ...staged, ...previous }
    setCurrent(recovered)
    await save(recovered).catch(() => {})
    throw error
  }
  try {
    await save(next)
    setCurrent(next)
    return true
  } catch {
    // The remote purchase is confirmed; keep the staged recovery copy.
    return false
  }
}
