import { useState, useCallback } from 'react';

export interface WinRecord {
  wins: number;
  losses: number;
  draws: number;
}

const STORAGE_KEY = 'blackpath-record';

function loadRecord(): Record<string, WinRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveRecord(records: Record<string, WinRecord>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch { /* ignore */ }
}

function emptyRecord(): WinRecord {
  return { wins: 0, losses: 0, draws: 0 };
}

export function useRecord() {
  const [records, setRecords] = useState(loadRecord);

  const getRecord = useCallback(
    (key: string): WinRecord => records[key] ?? emptyRecord(),
    [records],
  );

  const addResult = useCallback(
    (key: string, result: 'win' | 'loss' | 'draw') => {
      setRecords((prev) => {
        const rec = prev[key] ?? emptyRecord();
        const next = {
          ...prev,
          [key]: {
            wins: rec.wins + (result === 'win' ? 1 : 0),
            losses: rec.losses + (result === 'loss' ? 1 : 0),
            draws: rec.draws + (result === 'draw' ? 1 : 0),
          },
        };
        saveRecord(next);
        return next;
      });
    },
    [],
  );

  const resetRecords = useCallback(() => {
    setRecords({});
    saveRecord({});
  }, []);

  return { getRecord, addResult, resetRecords };
}
