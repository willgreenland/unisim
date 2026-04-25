import { Router } from 'express'
import { existsSync, readdirSync } from 'fs'
import path from 'path'

const router = Router()

router.get('/:simName', (req, res) => {
  const base = path.join(process.cwd(), 'data', req.params.simName)

  const readDir = (subdir: string): string[] => {
    const dir = path.join(base, subdir)
    return existsSync(dir)
      ? readdirSync(dir).filter(f => f.endsWith('.csv')).sort()
      : []
  }

  res.json({
    inputFiles: readDir('input'),
    outputFiles: readDir('output'),
  })
})

export default router
