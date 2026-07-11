export type OfflineQueueType = 'grades' | 'attendance' | 'evaluations';

export interface OfflineQueueItem {
  id: string;
  type: OfflineQueueType;
  payload: Record<string, any>;
  createdAt: string;
}

const STORAGE_KEY = 'hello:offline:queue';

function dispatchQueueUpdate() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('offline-queue-updated'));
}

function readQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage failures
  }
  dispatchQueueUpdate();
}

export function getOfflineQueue(): OfflineQueueItem[] {
  return readQueue();
}

export function enqueueOfflineItem(item: Omit<OfflineQueueItem, 'id' | 'createdAt'>) {
  const queue = readQueue();
  const entry: OfflineQueueItem = {
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
    ...item,
  };
  queue.push(entry);
  writeQueue(queue);
  return entry.id;
}

export function removeOfflineQueueItem(id: string) {
  const queue = readQueue().filter((entry) => entry.id !== id);
  writeQueue(queue);
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  dispatchQueueUpdate();
}

export interface QueuedGrades {
  id: string;
  classId: string;
  year: number;
  term: number;
  rows: Array<{ student_id: string; scores: Record<string, number>; observacao?: string | null }>;
  createdAt: string;
}

export interface QueuedAttendance {
  id: string;
  classId: string;
  date: string;
  examMode?: boolean;
  records: Array<{ student_id: string; status: string; note: string | null }>;
  createdAt: string;
}

export interface QueuedEvaluations {
  id: string;
  classId: string;
  year: number;
  term: number;
  rows: Array<{ student_id: string; marks: Record<string, { done: boolean; score: number | null }> }>;
  createdAt: string;
}

function filterQueueByType<T extends OfflineQueueType>(type: T) {
  return readQueue().filter((item) => item.type === type) as Array<OfflineQueueItem & { type: T }>;
}

export function getQueuedGrades(): QueuedGrades[] {
  return filterQueueByType('grades').map((item) => ({ id: item.id, createdAt: item.createdAt, ...(item.payload as Omit<QueuedGrades, 'id' | 'createdAt'>) }));
}

export function enqueueGrades(item: Omit<QueuedGrades, 'id' | 'createdAt'>) {
  return enqueueOfflineItem({ type: 'grades', payload: item });
}

export function removeQueuedGrade(id: string) {
  removeOfflineQueueItem(id);
}

export function getQueuedAttendance(): QueuedAttendance[] {
  return filterQueueByType('attendance').map((item) => ({ id: item.id, createdAt: item.createdAt, ...(item.payload as Omit<QueuedAttendance, 'id' | 'createdAt'>) }));
}

export function enqueueAttendance(item: Omit<QueuedAttendance, 'id' | 'createdAt'>) {
  return enqueueOfflineItem({ type: 'attendance', payload: item });
}

export function removeQueuedAttendance(id: string) {
  removeOfflineQueueItem(id);
}

export function getQueuedEvaluations(): QueuedEvaluations[] {
  return filterQueueByType('evaluations').map((item) => ({ id: item.id, createdAt: item.createdAt, ...(item.payload as Omit<QueuedEvaluations, 'id' | 'createdAt'>) }));
}

export function enqueueEvaluations(item: Omit<QueuedEvaluations, 'id' | 'createdAt'>) {
  return enqueueOfflineItem({ type: 'evaluations', payload: item });
}

export function removeQueuedEvaluations(id: string) {
  removeOfflineQueueItem(id);
}

export async function syncOfflineQueue(
  handler: (item: OfflineQueueItem) => Promise<boolean>,
): Promise<number> {
  const queue = readQueue();
  let removed = 0;
  for (const item of queue) {
    try {
      const ok = await handler(item);
      if (ok) {
        removeOfflineQueueItem(item.id);
        removed += 1;
      }
    } catch {
      break;
    }
  }
  return removed;
}
