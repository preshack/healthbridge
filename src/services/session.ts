// src/services/session.ts
// In-memory session manager with 30-minute expiry
import { Session } from '../types/index.js';
import { hashPhone } from './security.js';

const sessions = new Map<string, Session>();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function getOrCreateSession(rawPhone: string): Session {
  const hashed = hashPhone(rawPhone);
  let session = sessions.get(hashed);

  if (!session || Date.now() - session.lastActivity > SESSION_TIMEOUT) {
    session = {
      hashedPhone: hashed,
      rawPhone,
      language: 'en',
      currentFlow: 'idle',
      triageStep: 0,
      triageData: {},
      medications: [],
      hasSeenUploadTip: false,
      messageCount: 0,
      lastActivity: Date.now(),
      conversationHistory: [],
    };
    sessions.set(hashed, session);
  }

  session.lastActivity = Date.now();
  session.messageCount++;
  return session;
}

export function updateSession(session: Session): void {
  sessions.set(session.hashedPhone, session);
}

export function resetFlow(session: Session): void {
  session.currentFlow = 'idle';
  session.triageStep = 0;
  session.triageData = {};
}

export function addToConversationHistory(
  session: Session,
  role: 'user' | 'assistant',
  content: string
): void {
  session.conversationHistory.push({ role, content });
  // Keep bounded — last 20 messages
  if (session.conversationHistory.length > 20) {
    session.conversationHistory = session.conversationHistory.slice(-20);
  }
}

// Cleanup expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Get active session count (for health endpoint)
export function getActiveSessionCount(): number {
  return sessions.size;
}
