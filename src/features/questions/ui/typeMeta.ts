import { CheckCheck, Keyboard, ListChecks, PieChart, type LucideIcon } from 'lucide-react'
import type { PaletteColor, PatternName } from '@/lib/palette'
import type { QuestionType } from '../model'

/** Visual identity of each question type (picker, thumbnails, badges). */
export const QUESTION_TYPE_META: Record<QuestionType, { icon: LucideIcon; color: PaletteColor; pattern: PatternName }> = {
  quiz: { icon: ListChecks, color: 'vermilion', pattern: 'stripes' },
  true_false: { icon: CheckCheck, color: 'teal', pattern: 'waves' },
  text: { icon: Keyboard, color: 'cobalt', pattern: 'dots' },
  poll: { icon: PieChart, color: 'amber', pattern: 'zigzag' },
}
