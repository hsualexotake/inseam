/**
 * Type definitions for Nylas integration
 */

/**
 * Email data structure from Nylas API
 */
export interface NylasEmail {
  id: string;
  thread_id: string;
  subject: string | null;
  from: NylasParticipant[];
  to: NylasParticipant[];
  cc?: NylasParticipant[];
  bcc?: NylasParticipant[];
  date: number;
  snippet: string;
  body?: string;
  unread: boolean;
  attachments?: NylasAttachment[];
}

export interface NylasParticipant {
  email: string;
  name?: string;
}

export interface NylasAttachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

/**
 * Formatted email for frontend display
 */
export interface FormattedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: {
    email: string;
    name?: string;
  };
  to: NylasParticipant[];
  date: number;
  snippet: string;
  body: string;
  unread: boolean;
  hasAttachments: boolean;
}

/**
 * Email fetch result
 */
export interface EmailFetchResult {
  emails: FormattedEmail[];
  totalCount: number;
  grant: {
    email: string;
    provider: string;
  };
}

/**
 * Email summary result
 */
export interface EmailSummaryResult {
  summary: string;
  threadId: string | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

/**
 * Nylas grant stored in database
 */
export interface NylasGrant {
  grantId: string;
  email: string;
  provider: string;
  accessToken: string; // Encrypted
  refreshToken?: string; // Encrypted
  expiresAt?: number;
}

/**
 * OAuth token response from Nylas
 */
export interface NylasTokenResponse {
  grant_id: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  id_token?: string;
  email: string;
}

/**
 * Nylas grant info response
 */
export interface NylasGrantInfo {
  id: string;
  email: string;
  provider: string;
  scope: string[];
  created_at: number;
  updated_at: number;
}

/**
 * Nylas API response wrapper
 */
export interface NylasApiResponse<T> {
  data: T[];
  next_cursor?: string;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  connected: boolean;
  email?: string;
  provider?: string;
  message: string;
}

/**
 * OAuth state for CSRF protection
 */
export interface OAuthState {
  state: string;
  userId: string;
  redirectUri: string;
  createdAt: number;
}