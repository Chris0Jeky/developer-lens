
import { z } from 'zod'

const nonBlankBoundedText = z.string()
  .min(1)
  .max(240)
  .superRefine((value, ctx) => {
    if (!/\S/u.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'text must contain a non-whitespace character' })
    }
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i)
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(i + 1)
        if (next < 0xdc00 || next > 0xdfff) {
          ctx.addIssue({ code: 'custom', message: 'lone surrogate is not allowed' })
          return
        }
        i += 1
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        ctx.addIssue({ code: 'custom', message: 'lone surrogate is not allowed' })
        return
      }
    }
  })

export const SafeFindingTextSchema = z.strictObject({
  title: nonBlankBoundedText,
  question: nonBlankBoundedText,
  summary: nonBlankBoundedText,
})

export function safeHashRefinement(
  value: unknown,
  ctx: z.RefinementCtx,
  computeHash: (value: unknown) => string,
  expected: string,
): void {
  try {
    if (computeHash(value) !== expected) {
      ctx.addIssue({ code: 'custom', message: 'bundle hash does not match canonical body' })
    }
  } catch {
    ctx.addIssue({ code: 'custom', message: 'body cannot be canonically hashed' })
  }
}
