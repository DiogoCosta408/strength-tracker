// Thin REST wrapper over the Drive v3 API, scoped to the hidden appDataFolder. Every
// function takes the access token as a parameter (no internal auth state) so it stays
// easy to mock in tests and reusable by the dev-only mock in googleDriveMock.ts.

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

async function checkOk(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`Drive API error ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res;
}

export async function findFile(token: string, name: string): Promise<DriveFile | undefined> {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and trashed=false`);
  const url = `${API}?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`;
  const res = await checkOk(await fetch(url, { headers: { Authorization: `Bearer ${token}` } }));
  const data = (await res.json()) as { files: DriveFile[] };
  return data.files[0];
}

export async function listFiles(token: string, namePrefix?: string): Promise<DriveFile[]> {
  const q = namePrefix ? `&q=${encodeURIComponent(`name contains '${namePrefix.replace(/'/g, "\\'")}' and trashed=false`)}` : '';
  const url = `${API}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1000${q}`;
  const res = await checkOk(await fetch(url, { headers: { Authorization: `Bearer ${token}` } }));
  const data = (await res.json()) as { files: DriveFile[] };
  return data.files;
}

export async function downloadFile(token: string, fileId: string): Promise<string> {
  const res = await checkOk(await fetch(`${API}/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } }));
  return res.text();
}

/** Creates a new file in appDataFolder. */
export async function createFile(token: string, name: string, content: string): Promise<DriveFile> {
  const boundary = 'strength-tracker-sync-boundary';
  const metadata = JSON.stringify({ name, parents: ['appDataFolder'] });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const res = await checkOk(
    await fetch(`${UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }),
  );
  return res.json();
}

/** Overwrites the content of an existing file. */
export async function updateFile(token: string, fileId: string, content: string): Promise<DriveFile> {
  const res = await checkOk(
    await fetch(`${UPLOAD_API}/${fileId}?uploadType=media&fields=id,name,modifiedTime`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: content,
    }),
  );
  return res.json();
}

/** Create-or-update by name: looks the file up first, so callers don't need to track the file id. */
export async function upsertFile(token: string, name: string, content: string): Promise<DriveFile> {
  const existing = await findFile(token, name);
  return existing ? updateFile(token, existing.id, content) : createFile(token, name, content);
}

export async function deleteFile(token: string, fileId: string): Promise<void> {
  await checkOk(await fetch(`${API}/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }));
}
