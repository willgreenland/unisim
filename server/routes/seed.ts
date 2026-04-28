import { Router } from 'express';
import { generateSeed } from '../engine/seed.js';

const router = Router();

router.post('/:simName', async (req, res) => {
  const { numFaculty = 100 } = req.body as { numFaculty?: number };
  try {
    await generateSeed(req.params.simName, numFaculty);
    res.json({ message: `Seed generated: ${numFaculty} faculty.` });
  } catch (err) {
    res.status(500).json({ message: String(err) });
  }
});

export default router;
