// Small wrappers around localStorage: it can be missing or throw (private mode, blocked storage).

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not persisted; the app still works for this visit.
  }
}

export function randomId(length = 10): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** This device's player id and nickname. */
export interface Me {
  pid: string;
  name: string;
}

// Without Supabase (local development) players are browser tabs, so each tab gets its own identity.
const perTab = !import.meta.env.VITE_SUPABASE_URL;

function readMe(): Partial<Me> {
  try {
    const raw = perTab ? sessionStorage.getItem('me') : null;
    if (raw) return JSON.parse(raw) as Partial<Me>;
  } catch {
    // fall through
  }
  return perTab ? {} : load<Partial<Me>>('me', {});
}

function writeMe(value: Me): void {
  if (perTab) {
    try {
      sessionStorage.setItem('me', JSON.stringify(value));
    } catch {
      // not persisted
    }
  } else save('me', value);
}

export function me(): Me {
  const stored = readMe();
  const value: Me = { pid: stored.pid ?? randomId(12), name: stored.name ?? '' };
  if (!stored.pid) writeMe(value);
  return value;
}

export function setName(name: string): void {
  writeMe({ ...me(), name: name.trim().slice(0, 24) });
}
