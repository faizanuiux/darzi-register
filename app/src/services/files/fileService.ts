// Low-level file helpers used by export / import / backup services.
//
// File picking uses `@react-native-documents/picker` (react-native-fs
// ships no picker). pickCsv() below opens it in 'import' mode.

import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
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
 * Let the user choose a CSV file from the device.
 *
 * Returns a readable local file path, or null when the user cancels —
 * cancellation is a silent no-op, never an error. Other picker failures
 * (no file manager, unreadable provider, …) are rethrown for the caller
 * to surface.
 *
 * `mode: 'import'` makes the picker copy the picked file into
 * app-private storage and return a `file://` URI for the copy, so
 * callers never have to juggle Android `content://` permissions — the
 * copy is read with readTextFile() and handed to parseCsv().
 */
export async function pickCsv(): Promise<string | null> {
  try {
    const [doc] = await pick({
      type: [types.csv, types.plainText],
      mode: 'import',
    });
    // Import mode yields a file:// URI; react-native-fs wants the plain
    // percent-decoded path.
    return doc.uri.startsWith('file://')
      ? decodeURIComponent(doc.uri.slice('file://'.length))
      : doc.uri;
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw err;
  }
}
