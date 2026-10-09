import { z } from 'zod'

export const emailSchema = z.email()
export const passwordSchema = z.string().min(8)
export const displayNameSchema = z.string().trim().min(1).max(60)

export type FieldErrors<K extends string> = Partial<Record<K, boolean>>

/** Validates fields individually so each one gets its own message. */
export function validateFields<K extends string>(
  values: Record<K, string>,
  schemas: Partial<Record<K, z.ZodType>>,
): FieldErrors<K> {
  const errors: FieldErrors<K> = {}
  for (const key of Object.keys(schemas) as K[]) {
    if (!schemas[key]!.safeParse(values[key]).success) errors[key] = true
  }
  return errors
}
