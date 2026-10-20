// Google Drive backup — STUB ONLY.
//
// Every operation throws until the owner completes the one-time setup
// described in docs/GOOGLE-DRIVE-SETUP.md (Google Cloud project, OAuth
// consent, Android OAuth client, Drive API, drive.file scope) and this file is
// implemented with @react-native-google-signin/google-signin + Drive REST v3.
//
// Privacy rule: backups contain customer PII. Nothing is uploaded unless the
// user taps it explicitly — there is deliberately no auto-sync here.

export interface DriveBackupInfo {
  id: string;
  name: string;
  createdTime: string;
  sizeBytes: number;
}

const NOT_CONFIGURED =
  'Google Drive not configured: OAuth client ID required — see docs/GOOGLE-DRIVE-SETUP.md';

export interface DriveService {
  /** Always false until the Drive integration is configured. */
  isConfigured(): boolean;
  /** Start the Google sign-in / OAuth flow. */
  connect(): Promise<void>;
  /** Upload a backup folder (or zip) to Drive; resolves the Drive file id. */
  uploadBackup(localPath: string): Promise<string>;
  /** Download a Drive backup into a local dir; resolves the local dir path. */
  downloadBackup(remoteId: string, destDir: string): Promise<string>;
  /** List Darzi Register backups stored on Drive, newest first. */
  listBackups(): Promise<DriveBackupInfo[]>;
}

export class GoogleDriveService implements DriveService {
  isConfigured(): boolean {
    return false;
  }

  async connect(): Promise<void> {
    throw new Error(NOT_CONFIGURED);
  }

  async uploadBackup(_localPath: string): Promise<string> {
    throw new Error(NOT_CONFIGURED);
  }

  async downloadBackup(_remoteId: string, _destDir: string): Promise<string> {
    throw new Error(NOT_CONFIGURED);
  }

  async listBackups(): Promise<DriveBackupInfo[]> {
    throw new Error(NOT_CONFIGURED);
  }
}

/** Singleton used by the UI. Swap the implementation here once configured. */
export const driveService: DriveService = new GoogleDriveService();
