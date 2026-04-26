import { Router } from 'express';
import { generateSeed } from '../engine/seed.js';

const router = Router();

router.post('/:simName', async (req, res) => {
  const { numStudents = 1000, numFaculty = 100 } = req.body as {
    numStudents?: number;
    numFaculty?: number;
  };
  try {
    await generateSeed(req.params.simName, numStudents, numFaculty);
    res.json({ message: `Seed generated: ${numStudents} students, ${numFaculty} faculty.` });
  } catch (err) {
    res.status(500).json({ message: String(err) });
  }
});

export default router;
