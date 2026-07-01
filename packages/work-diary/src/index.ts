export interface WorkDiaryEntry {
  id: string;
  event_id: string;
  phase: 'bozza' | 'confermato' | 'esecuzione' | 'completato';
  task: string;
  status: 'todo' | 'done' | 'cancelled';
  notes: string | null;
  financial_link: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiarySummary {
  total: number;
  todo: number;
  done: number;
  cancelled: number;
  phase: string;
}

export {
  createDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
  getDiaryEntries,
  getDiarySummary,
  updateEventPhase,
} from './service';
