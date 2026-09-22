import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { SUGGESTED_QUESTIONS, type ChatState, type UiMessage } from './useChat';

const SERVICE_CTA_CATEGORIES = new Set(['services', 'scheduling', 'pricing', 'emergency', 'service_area']);

interface ChatPanelProps {
  /** Shared chat state (owned by ChatWidgetProvider so it survives minimizing and navigation). */
  chat: ChatState;
  /** Called when the customer asks for human help; `question` is their most recent question. */
  onRequestHelp: (question: string, sessionId?: string) => void;
}

/** The conversation body: message log, suggestions, input, and disclaimer. */
export function ChatPanel({ chat, onRequestHelp }: ChatPanelProps) {
  const { messages, loading, send, sessionId } = chat;
  const [draft, setDraft] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, loading]);

  async function submit(text: string) {
    setInputError(null);
    const result = await send(text);
    if (result.ok) setDraft('');
    else setInputError(result.error);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(draft);
  }

  function questionBefore(message: UiMessage): string {
    const index = messages.findIndex((m) => m.id === message.id);
    for (let i = index - 1; i >= 0; i--) {
      const candidate = messages[i];
      if (candidate?.role === 'user') return candidate.content;
    }
    return '';
  }

  const onlyWelcome = messages.length === 1;

  return (
    <>
      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" tabIndex={0} aria-label="Conversation">
        {messages.map((message) => {
          const showPrompt = message.role === 'assistant' && message.requiresEscalation && !dismissed.has(message.id);
          const showServiceCta =
            message.role === 'assistant' && !message.isError && message.category && SERVICE_CTA_CATEGORIES.has(message.category);
          return (
            <div key={message.id} className={`chat-row chat-row-${message.role}`}>
              <div className={`bubble bubble-${message.role}${message.isError ? ' bubble-error' : ''}`}>
                <span className="bubble-author">{message.role === 'user' ? 'You' : 'OfficeLume (AI)'}</span>
                <p>{message.content}</p>
              </div>
              {showPrompt && (
                <div className="escalation-prompt" role="group" aria-label="Human help options">
                  <p>Would you like a team member to follow up?</p>
                  <div className="escalation-actions">
                    <Button size="sm" onClick={() => onRequestHelp(questionBefore(message), sessionId)}>
                      Request Human Help
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setDismissed((d) => new Set(d).add(message.id))}>
                      Continue Chatting
                    </Button>
                  </div>
                </div>
              )}
              {showServiceCta && !showPrompt && (
                <Link className="inline-cta" to="/request-service">
                  Request service →
                </Link>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="chat-row chat-row-assistant" role="status" aria-live="polite">
            <div className="bubble bubble-assistant bubble-typing">
              <span className="bubble-author">OfficeLume (AI)</span>
              <p>
                <span className="typing-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                Checking our approved information…
              </p>
            </div>
          </div>
        )}
      </div>

      {onlyWelcome && !loading && (
        <div className="chip-row" aria-label="Suggested questions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => void submit(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={onSubmit} noValidate>
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <input
          id="chat-input"
          className="input"
          type="text"
          autoComplete="off"
          maxLength={500}
          placeholder="Type your question…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={inputError ? true : undefined}
          aria-describedby={inputError ? 'chat-input-error' : 'chat-disclaimer'}
          disabled={loading}
        />
        <Button type="submit" loading={loading} disabled={draft.trim().length === 0}>
          Send
        </Button>
      </form>
      {inputError && (
        <p id="chat-input-error" className="field-error chat-error" role="alert">
          {inputError}
        </p>
      )}
      <p id="chat-disclaimer" className="chat-disclaimer">
        You are interacting with an AI-assisted receptionist. Complex or unsupported requests may be forwarded to a human
        representative. Please don’t share sensitive information in chat.
      </p>
    </>
  );
}
