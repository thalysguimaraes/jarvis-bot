export interface KVNote {
  id: string;
  content: string;
  timestamp: string;
  userId: string;
  synced: boolean;
}

export interface NotesResponse {
  notes: KVNote[];
  count: number;
  lastSync?: string;
}