/** Resize a photo in the browser and re-encode it as JPEG, so the repo only stores web-sized images. */
export async function resizeImage(file: File, maxEdge = 2000, quality = 0.85): Promise<Uint8Array> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`This browser can't read "${file.name}". Try a JPEG or PNG (iPhone HEIC photos work in Safari).`)
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error("Couldn't process the image.")
  return new Uint8Array(await blob.arrayBuffer())
}
