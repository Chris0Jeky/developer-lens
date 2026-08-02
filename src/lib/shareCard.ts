import type { SharePayload } from './sharePayload.js'
import { buildShareCardSvg } from './shareCardMarkup.js'

export { buildShareCardSvg }

export async function createShareCardPng(payload: SharePayload): Promise<Blob> {
  const svgBlob = new Blob([buildShareCardSvg(payload)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('The share card could not be rendered.'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot render the share card.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('The share card could not be exported.'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
