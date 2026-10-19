// Dev-only stand-in for googleAuth.ts + googleDrive.ts, used when no real OAuth client id
// is configured so Settings → Cloud sync can be clicked through end to end in `npm run dev`
// without a Google Cloud project. "Files" are kept in localStorage so they survive reloads.
// Swapped in by main.tsx via sync.ts's setSyncBackend() — never used in a production build.
import { ReconnectRequiredError } from './googleAuth';
import type { DriveFile } from './googleDrive';

export { ReconnectRequiredError };

const CONNECTED_KEY = 'gdrive-mock-connected';
const FILES_KEY = 'gdrive-mock-files';
const MOCK_TOKEN = 'mock-token';

interface MockFile extends DriveFile {
  content: string;
}

function readFiles(): MockFile[] {
  try {
    return JSON.parse(localStorage.getItem(FILES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeFiles(files: MockFile[]): void {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  } catch {
    /* storage unavailable */
  }
}

export function isConnected(): boolean {
  try {
    return localStorage.getItem(CONNECTED_KEY) === '1';
  } catch {
    return false;
  }
}

export async function connect(): Promise<void> {
  try {
    localStorage.setItem(CONNECTED_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

export function disconnect(): void {
  try {
    localStorage.removeItem(CONNECTED_KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function getAccessToken(): Promise<string> {
  if (!isConnected()) throw new ReconnectRequiredError('Not connected (mock).');
  return MOCK_TOKEN;
}

export async function findFile(_token: string, name: string): Promise<DriveFile | undefined> {
  return readFiles().find((f) => f.name === name);
}

export async function listFiles(_token: string, namePrefix?: string): Promise<DriveFile[]> {
  const files = readFiles();
  return namePrefix ? files.filter((f) => f.name.includes(namePrefix)) : files;
}

export async function downloadFile(_token: string, fileId: string): Promise<string> {
  const f = readFiles().find((x) => x.id === fileId);
  if (!f) throw new Error('Mock file not found.');
  return f.content;
}

async function createFile(name: string, content: string): Promise<DriveFile> {
  const files = readFiles();
  const f: MockFile = { id: `mock-${Math.random().toString(36).slice(2)}`, name, content, modifiedTime: new Date().toISOString() };
  files.push(f);
  writeFiles(files);
  return f;
}

async function updateFile(fileId: string, content: string): Promise<DriveFile> {
  const files = readFiles();
  const f = files.find((x) => x.id === fileId);
  if (!f) throw new Error('Mock file not found.');
  f.content = content;
  f.modifiedTime = new Date().toISOString();
  writeFiles(files);
  return f;
}

export async function upsertFile(token: string, name: string, content: string): Promise<DriveFile> {
  const existing = await findFile(token, name);
  return existing ? updateFile(existing.id, content) : createFile(name, content);
}

export async function deleteFile(_token: string, fileId: string): Promise<void> {
  writeFiles(readFiles().filter((f) => f.id !== fileId));
}
