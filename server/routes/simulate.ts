import { Router } from 'express';
import { runPipeline } from '../engine/pipeline.js';

const router = Router();

router.post('/:simName', async (req, res) => {
  try {
    await runPipeline(req.params.simName);
    res.json({ message: 'Term simulation complete.' });
  } catch (err) {
    res.status(500).json({ message: String(err) });
  }
});

export default router;
