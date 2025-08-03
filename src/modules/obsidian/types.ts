export interface ObsidianNote {
  content: string;
  metadata: NoteMetadata;
}

export interface NoteMetadata {
  timestamp: Date;
  source: 'whatsapp_audio';
  userId: string;
  transcriptionLength: number;
}

export interface ObsidianConfig {
  storageType: 'github' | 'dropbox' | 'gdrive' | 's3';
  dailyNote: boolean;
  notePath?: string;
  noteFormat: 'daily' | 'individual';
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  vaultPath: string;
}

export interface CloudStorageConfig {
  apiKey: string;
  folder: string;
}