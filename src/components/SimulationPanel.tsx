import { useEffect, useState } from 'react';

interface FileData {
  inputFiles: string[];
  outputFiles: string[];
}

export default function SimulationPanel({ simName }: { simName: string }) {
  const [files, setFiles] = useState<FileData>({ inputFiles: [], outputFiles: [] });
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');

  const loadFiles = () => {
    fetch(`/api/files/${simName}`)
      .then(r => r.json())
      .then((data: FileData) => setFiles(data))
      .catch(() => setFiles({ inputFiles: [], outputFiles: [] }));
  };

  useEffect(() => {
    loadFiles();
    setMessage('');
  }, [simName]);

  const handleRun = async () => {
    setRunning(true);
    setMessage('');
    try {
      const res = await fetch(`/api/simulate/${simName}`, { method: 'POST' });
      const data = await res.json() as { message: string };
      setMessage(data.message);
      loadFiles();
    } catch {
      setMessage('Error: could not connect to server.');
    } finally {
      setRunning(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Clear all output and regenerate seed data for "${simName}"? This cannot be undone.`)) return;
    setRunning(true);
    setMessage('');
    try {
      await fetch(`/api/reset/${simName}`, { method: 'POST' });
      const seedRes = await fetch(`/api/seed/${simName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await seedRes.json() as { message: string };
      setMessage(data.message);
      loadFiles();
    } catch {
      setMessage('Error: could not connect to server.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <h2>{simName}</h2>
      <section>
        <h3>Input Files</h3>
        {files.inputFiles.length === 0
          ? <p>No input files found at data/{simName}/input/</p>
          : <ul>{files.inputFiles.map(f => <li key={f}>{f}</li>)}</ul>
        }
      </section>
      <section>
        <h3>Output Files</h3>
        {files.outputFiles.length === 0
          ? <p>No output files yet.</p>
          : <ul>{files.outputFiles.map(f => <li key={f}>{f}</li>)}</ul>
        }
      </section>
      <button onClick={handleRun} disabled={running}>
        {running ? 'Running...' : 'Run Next Term'}
      </button>
      <button onClick={handleReset} disabled={running}>
        Reset &amp; Reseed
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
