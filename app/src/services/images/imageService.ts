// Customer photo handling: picking, app-private storage, and resolution.
//
// Storage contract: photos live under <DocumentDirectoryPath>/photos/ and the
// Customer record stores only the RELATIVE path (e.g. "photos/<id>.jpg") so
// backups/exports stay portable across reinstalls.
//
// COMPRESSION NOTE (deliberate limitation, not a TODO-fake): true resizing to
// ~480px needs a native module — add `react-native-image-resizer` later and
// resize inside persistPhoto before copying. This service intentionally does a
// best-effort verbatim copy today; it never claims to compress.

import { launchImageLibrary } from 'react-native-image-picker';
import { DocumentDirectoryPath, copyFile, exists, mkdir, unlink } from 'react-native-fs';

export const PHOTOS_DIR_NAME = 'photos';

function photosDir(): string {
  return `${DocumentDirectoryPath}/${PHOTOS_DIR_NAME}`;
}

function absolutePath(relativePath: string): string {
  return `${DocumentDirectoryPath}/${relativePath}`;
}

/** Open the system photo library; resolves the picked asset's URI, or null on cancel. */
export async function pickImage(): Promise<string | null> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
  });

  if (result.didCancel) {
    return null;
  }
  if (result.errorCode) {
    throw new Error(
      `Could not open the photo library (${result.errorCode})${result.errorMessage ? `: ${result.errorMessage}` : ''}.`,
    );
  }
  const uri = result.assets?.[0]?.uri;
  return uri ?? null;
}

/**
 * Copy a picked photo into app-private storage as photos/<customerId>.jpg and
 * return the relative path to store on the Customer record.
 *
 * Best-effort copy: the source may be a file:// URI (iOS) or content:// URI
 * (Android). react-native-fs normalizes file:// prefixes; a clear error is
 * thrown when the copy fails (e.g. revoked permission, missing file).
 */
export async function persistPhoto(uri: string, customerId: string): Promise<string> {
  if (!uri) {
    throw new Error('persistPhoto: no photo URI provided.');
  }
  if (!customerId) {
    throw new Error('persistPhoto: customerId is required.');
  }
  const dir = photosDir();
  if (!(await exists(dir))) {
    await mkdir(dir);
  }
  const relativePath = `${PHOTOS_DIR_NAME}/${customerId}.jpg`;
  const dest = absolutePath(relativePath);
  try {
    await copyFile(uri, dest);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not save the customer photo: ${detail}`);
  }
  return relativePath;
}

/** Resolve a stored relative photo path to an absolute path, or null when missing. */
export async function resolvePhoto(relativePath: string | null): Promise<string | null> {
  if (!relativePath) {
    return null;
  }
  const abs = absolutePath(relativePath);
  return (await exists(abs)) ? abs : null;
}

/** Delete a stored photo if it exists; silently resolves when already missing. */
export async function deletePhoto(relativePath: string | null): Promise<void> {
  if (!relativePath) {
    return;
  }
  const abs = absolutePath(relativePath);
  if (await exists(abs)) {
    await unlink(abs);
  }
}
