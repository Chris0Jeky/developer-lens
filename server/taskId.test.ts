import { describe, expect, it } from 'vitest'
import { isCanonicalTaskId } from './taskId.js'

describe('canonical activation task IDs', () => {
  it('accepts the exact shared grammar without normalizing it', () => {
    expect(isCanonicalTaskId('Upper_Task-01')).toBe(true)
    expect(isCanonicalTaskId('lower_task')).toBe(true)
  })

  it.each(['', '.', '..', '../outside', 'has space', 'task/child', 'task\\child', 'x'.repeat(129)])(
    'rejects malformed task ID %j',
    (value) => expect(isCanonicalTaskId(value)).toBe(false),
  )
})
