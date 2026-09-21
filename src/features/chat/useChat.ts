import { useCallback, useRef, useState } from 'react';
import { askOfficeLume } from '../../services/chatService';
import type { AICategory } from '../../types';
import { toAppError } from '../../utils/errors';
import { inquirySchema } from '../../validation/schemas';

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  requiresEscalation?: boolean;
  category?: AICategory;
  /** Technical/availability failure rather than a normal answer. */
  isError?: boolean;
}

export const WELCOME_MESSAGE =
  "Hi, I'm OfficeLume, an AI-assisted receptionist for our HVAC team. Ask me about hours, services, our service area, or scheduling - or request service any time.";

export const SUGGESTED_QUESTIONS = [
  'What areas do you service?',
  'What time do you open?',
  'Do you offer emergency HVAC service?',
  'How much does a repair cost?',
];

let counter = 0;
const nextId = () => `m${++counter}`;

export type SendResult = { ok: true } | { ok: false; error: string };

export function useChat() {
  const [messages, setMessages] = useState<UiMessage[]>([{ id: nextId(), role: 'assistant', content: WELCOME_MESSAGE }]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const sessionRef = useRef<string | undefined>(undefined);
  const busy = useRef(false);

  const append = useCallback((message: Omit<UiMessage, 'id'>) => {
    setMessages((current) => [...current, { ...message, id: nextId() }]);
  }, []);

  const send = useCallback(
    async (text: string): Promise<SendResult> => {
      const parsed = inquirySchema.safeParse({ message: text });
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please enter a question.' };
      if (busy.current) return { ok: false, error: 'Please wait for the current answer.' };

      busy.current = true;
      setLoading(true);
      append({ role: 'user', content: parsed.data.message });

      try {
        let result;
        try {
          result = await askOfficeLume(parsed.data.message, sessionRef.current);
        } catch (error) {
          const appError = toAppError(error);
          // The stored chat expired: start a fresh one transparently.
          if (appError.code !== 'not-found') throw appError;
          sessionRef.current = undefined;
          result = await askOfficeLume(parsed.data.message);
        }
        sessionRef.current = result.sessionId;
        setSessionId(result.sessionId);
        append({
          role: 'assistant',
          content: result.answer,
          requiresEscalation: result.requiresEscalation || !result.supported,
          category: result.category,
        });
      } catch (error) {
        const appError = toAppError(error);
        const retryable = appError.code === 'unavailable' || appError.code === 'offline' || appError.code === 'unknown';
        append({
          role: 'assistant',
          content: retryable
            ? "I'm having trouble reaching our system right now. Please try again in a moment, or I can send your request to a team member."
            : appError.message,
          requiresEscalation: retryable || appError.code === 'rate-limited',
          isError: true,
        });
      } finally {
        busy.current = false;
        setLoading(false);
      }
      return { ok: true };
    },
    [append],
  );

  return { messages, loading, send, sessionId };
}
