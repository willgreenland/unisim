import { Router } from 'express'
import { existsSync, readdirSync, unlinkSync } from 'fs'
import path from 'path'

const router = Router()

router.post('/:simName', (req, res) => {
  const outputDir = path.join(process.cwd(), 'data', req.params.simName, 'output')
  if (!existsSync(outputDir)) {
    res.json({ message: 'Nothing to reset.' })
    return
  }
  const files = readdirSync(outputDir).filter(f => f.endsWith('.csv'))
  for (const file of files) {
    unlinkSync(path.join(outputDir, file))
  }
  res.json({ message: `Reset complete. Removed ${files.length} output file(s).` })
})

export default router
