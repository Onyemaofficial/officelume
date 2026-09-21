import type { ChatResult } from '../types';
import { callFunction } from './callables';

/** Ask the AI receptionist. The API key and knowledge retrieval live entirely server-side. */
export function askOfficeLume(message: string, sessionId?: string): Promise<ChatResult> {
  return callFunction<{ message: string; sessionId?: string }, ChatResult>('askOfficeLume', {
    message,
    ...(sessionId ? { sessionId } : {}),
  });
}
