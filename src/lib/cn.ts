type ClassValue = string | false | null | undefined | 0

/** Joins truthy class names. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}
