import express from 'express'
import filesRouter from './routes/files.js'
import simulateRouter from './routes/simulate.js'
import resetRouter from './routes/reset.js'
import seedRouter from './routes/seed.js'

const app = express()
app.use(express.json())
app.use('/api/files', filesRouter)
app.use('/api/simulate', simulateRouter)
app.use('/api/reset', resetRouter)
app.use('/api/seed', seedRouter)

const PORT = 3001
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))
