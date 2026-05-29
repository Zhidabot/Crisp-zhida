export type NativeEvent = 'message:send' | 'message:received' | 'action:control' | 'message:assistant';

export interface NativeEnvelope<TData> {
  event: NativeEvent;
  timestamp: number;
  token: string;
  data: TData;
}

export interface NativeBaseData {
  fingerprint: string;
  timestamp: number;
  token: string;
  session_id: string;
}

export interface NativeUser {
  id?: string;
  nickname?: string;
}

export interface NativeAttachment {
  type: 'image' | 'audio';
  url: string;
  mime_type: string;
  duration_ms?: number;
}

export interface NativeContent {
  text?: string;
  attachments?: NativeAttachment[];
}

export interface NativeMessageData extends NativeBaseData {
  user: NativeUser;
  content: NativeContent;
}

export interface NativeActionControlData extends NativeBaseData {
  action: 'disable_ai' | 'enable_ai' | 'refresh_status';
  user: NativeUser;
}

export interface NativeAssistantMessage {
  event: 'message:assistant';
  timestamp: number;
  data: {
    fingerprint: string;
    timestamp: number;
    session_id: string;
    user?: NativeUser;
    content: NativeContent;
  };
}

export interface CrispEnvelope {
  website_id: string;
  event: string;
  timestamp?: number;
  data?: unknown;
}

export interface CrispUser {
  type?: string;
  nickname?: string;
  user_id?: string;
  avatar?: string;
}

export interface CrispMessageData {
  website_id?: string;
  session_id?: string;
  type?: string;
  origin?: string;
  content?: unknown;
  timestamp?: number;
  fingerprint?: number | string;
  from?: string;
  user?: CrispUser;
  automated?: boolean;
}

export interface CrispActionRequest {
  action?: unknown;
  token?: string;
  website_id?: string;
  session_id?: string;
  origin?: {
    website_id?: string;
    session_id?: string;
    token?: string;
  };
  widget?: {
    section_id?: string;
    item_id?: string;
  };
  payload?: {
    enabled?: boolean;
    mode?: string;
    session_id?: string;
    data?: Record<string, unknown>;
  };
  data?: Record<string, unknown>;
  timestamp?: number;
}

export interface SessionRecord {
  sessionID: string;
  websiteID: string;
  customerID?: string;
  customerName?: string;
  updatedAt: string;
}
