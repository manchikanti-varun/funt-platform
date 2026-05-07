export interface CollaboratorPresence {
  userId: string;
  displayName: string;
  color: string;
  avatarUrl?: string;
  cursor?: {
    from: number;
    to: number;
  };
}

export interface CollaborationConfig {
  enabled: boolean;
  documentId: string;
  websocketUrl: string;
  yjsRoomName: string;
  token?: string;
}

export interface VersionSnapshot {
  id: string;
  documentId: string;
  label: string;
  createdAt: string;
  createdBy: string;
}

export interface CommentThread {
  id: string;
  documentId: string;
  anchor: {
    from: number;
    to: number;
  };
  resolved: boolean;
}
