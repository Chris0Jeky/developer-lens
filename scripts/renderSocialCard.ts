import { resolve } from 'node:path'
import sharp from 'sharp'

const source = resolve('public', 'social-card.svg')
const target = resolve('public', 'social-card.png')

await sharp(source, { density: 144 })
  .resize(1200, 630)
  .png({ compressionLevel: 9, palette: true })
  .toFile(target)

console.log('Rendered public/social-card.png at 1200 × 630.')
