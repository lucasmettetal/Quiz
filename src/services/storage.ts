import { getSupabase, MEDIA_BUCKET } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024
const MAX_DIMENSION = 1600

export function validateImage(file: File) {
  if (!ACCEPTED.includes(file.type)) throw new AppError('MEDIA_INVALID')
  if (file.size > MAX_BYTES * 4) throw new AppError('MEDIA_TOO_LARGE')
}

/**
 * Downscales big photos and re-encodes them as WebP in the browser: a
 * projector never needs a 12 MP picture, and phones load questions faster.
 * GIFs are kept as-is to preserve animation.
 */
async function optimize(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || typeof createImageBitmap === 'undefined') return file
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new AppError('MEDIA_INVALID')
  })
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
  return blob && blob.size < file.size ? blob : file
}

/** Uploads an image under the user's folder and returns its storage path. */
export async function uploadQuizImage(file: File, userId: string): Promise<string> {
  validateImage(file)
  const blob = await optimize(file)
  if (blob.size > MAX_BYTES) throw new AppError('MEDIA_TOO_LARGE')
  const ext = blob.type === 'image/webp' ? 'webp' : (file.name.split('.').pop()?.toLowerCase() ?? 'img')
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await getSupabase()
    .storage.from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: blob.type || file.type, cacheControl: '31536000', upsert: false })
  if (error) throw toAppError(error)
  return path
}
