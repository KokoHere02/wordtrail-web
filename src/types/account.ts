export interface AuthSession {
  sessionId: string; deviceName: string; current: boolean;
  createdAt: string; lastRefreshedAt: string; expiresAt: string;
}
