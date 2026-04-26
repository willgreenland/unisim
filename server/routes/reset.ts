import { Router } from 'express'
import { existsSync, readdirSync, unlinkSync } from 'fs'
import path from 'path'

const router = Router()

function unlinkRetry(filePath: string, retries = 5, delayMs = 100): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = (n: number) => {
      try {
        unlinkSync(filePath)
        resolve()
      } catch (err: any) {
        if (err.code === 'EBUSY' && n > 0) {
          setTimeout(() => attempt(n - 1), delayMs)
        } else {
          reject(err)
        }
      }
    }
    attempt(retries)
  })
}

router.post('/:simName', async (req, res) => {
  const outputDir = path.join(process.cwd(), 'data', req.params.simName, 'output')
  if (!existsSync(outputDir)) {
    res.json({ message: 'Nothing to reset.' })
    return
  }
  const files = readdirSync(outputDir).filter(f => f.endsWith('.csv'))
  for (const file of files) {
    await unlinkRetry(path.join(outputDir, file))
  }
  res.json({ message: `Reset complete. Removed ${files.length} output file(s).` })
})

export default router
