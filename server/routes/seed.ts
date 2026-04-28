import { Router } from 'express';
import { generateSeed } from '../engine/seed.js';

const router = Router();

router.post('/:simName', async (req, res) => {
  try {
    await generateSeed(req.params.simName);
    res.json({ message: 'Seed initialized.' });
  } catch (err) {
    res.status(500).json({ message: String(err) });
  }
});

export default router;
