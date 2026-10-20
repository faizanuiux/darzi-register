// Low-level file helpers used by export / import / backup services.
//
// DOCUMENT PICKER NOTE: react-native-fs (2.20) ships NO document picker
// (verified against its type surface). CSV import currently cannot open a
// system file picker, so pickCsv() below is an honest stub that throws a clear
// "not configured" error. To wire real picking: add
// `@react-native-documents/picker` and implement pickCsv() with
// pick({ type: [types.csv] }) — see the error message for the exact pointer.

import {
  DocumentDirectoryPath,
  exists,
  mkdir,
  readDir,
  readFile,
  unlink,
  writeFile,
} from 'react-native-fs';
import Share from 'react-native-share';

export { DocumentDirectoryPath };

/** Create a directory (and parents) if it does not exist. */
export async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path);
  }
}

/** Write UTF-8 text to a file, creating parent expectations via ensureDir first. */
export async function writeTextFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf8');
}

/** Read a UTF-8 text file. */
export async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

/** Read a file as base64 (used to embed photos into PDFs). */
export async function readFileBase64(path: string): Promise<string> {
  return readFile(path, 'base64');
}

/** List absolute paths of all entries directly inside a directory. */
export async function listFiles(dir: string): Promise<string[]> {
  const items = await readDir(dir);
  return items.map(item => item.path);
}

/** True when the path exists (file or directory). */
export async function fileExists(path: string): Promise<boolean> {
  return exists(path);
}

/** Remove a file if it exists; resolves silently when missing. */
export async function deleteFile(path: string): Promise<void> {
  if (await exists(path)) {
    await unlink(path);
  }
}

/**
 * Open the OS share sheet for a local file.
 * Customer data leaves the device ONLY through this explicit user action.
 */
export async function shareFile(path: string, mime: string, title?: string): Promise<void> {
  await Share.open({
    url: `file://${path}`,
    type: mime,
    title,
  });
}

/**
 * STUB — not configured. Lets the user choose a CSV file from the device.
 *
 * Throws until `@react-native-documents/picker` is installed and this
 * function is implemented with:
 *
 *   import { pick, types } from '@react-native-documents/picker';
 *   const [doc] = await pick({ type: [types.csv] });
 *   // then readTextFile(doc.uri) and hand the text to parseCsv().
 */
export async function pickCsv(): Promise<never> {
  throw new Error(
    'CSV import is not configured: this app needs @react-native-documents/picker ' +
      'to open a file picker (react-native-fs has no picker). ' +
      'Install it and implement pickCsv() in src/services/files/fileService.ts.',
  );
}
