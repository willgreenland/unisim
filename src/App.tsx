import { useState } from 'react'
import SimulationPanel from './components/SimulationPanel'

export default function App() {
  const [inputValue, setInputValue] = useState('koona_university')
  const [activeSim, setActiveSim] = useState('koona_university')

  return (
    <main>
      <h1>UniSim</h1>
      <div>
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="simulation name (e.g. koona_university)"
        />
        <button onClick={() => setActiveSim(inputValue)}>Load</button>
      </div>
      <SimulationPanel simName={activeSim} />
    </main>
  )
}
