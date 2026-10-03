/** Never publish a passing receipt before cleanup and network-isolation checks. */
export async function finishPointerReceipt(receipt, close, emit = console.log) {
  try {
    await close()
    if (receipt.phase === 'complete') receipt.status = 'passed'
  } catch {
    receipt.status = 'failed'
    receipt.cleanup = 'failed'
    if (receipt.phase === 'complete') receipt.phase = 'cleanup'
    throw new Error('Pointer session cleanup or isolation validation failed')
  } finally {
    emit(JSON.stringify(receipt))
  }
}
