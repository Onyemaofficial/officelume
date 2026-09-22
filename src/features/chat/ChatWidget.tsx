import type { KeyboardEvent } from 'react';
import { LogoMark } from '../../components/Logo';
import { EscalationForm } from '../escalations/EscalationForm';
import { ChatPanel } from './ChatPanel';
import { lastUserQuestion, type ChatState } from './useChat';

export type WidgetView = 'chat' | 'help';

export interface HelpContext {
  question: string;
  sessionId?: string | undefined;
}

interface ChatWidgetProps {
  isOpen: boolean;
  view: WidgetView;
  chat: ChatState;
  help: HelpContext;
  unread: number;
  onOpen: () => void;
  onMinimize: () => void;
  onRequestHelp: (question: string, sessionId?: string) => void;
  onBackToChat: () => void;
}

/**
 * The floating chat window / launcher, fixed to the lower-right of every public page.
 * The window stays mounted while minimized (just hidden) so scroll position and typing survive.
 */
export function ChatWidget({ isOpen, view, chat, help, unread, onOpen, onMinimize, onRequestHelp, onBackToChat }: ChatWidgetProps) {
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onMinimize();
    }
  }

  return (
    <div className="chat-widget">
      <section
        id="chat-window"
        className="chat-window"
        role="dialog"
        aria-modal="false"
        aria-label="OfficeLume chat assistant"
        hidden={!isOpen}
        onKeyDown={onKeyDown}
      >
        <header className="chat-window-header">
          <div className="chat-window-title">
            <LogoMark />
            <div>
              <h2>OfficeLume</h2>
              <p>AI-assisted receptionist</p>
            </div>
          </div>
          <div className="chat-window-actions">
            {view === 'chat' ? (
              <button type="button" className="chat-header-btn" onClick={() => onRequestHelp(lastUserQuestion(chat.messages), chat.sessionId)}>
                Talk to a person
              </button>
            ) : (
              <button type="button" className="chat-header-btn" onClick={onBackToChat}>
                ← Back to chat
              </button>
            )}
            <button type="button" className="chat-header-btn" onClick={onMinimize} aria-label="Minimize chat" title="Minimize">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>
        </header>

        <div className="chat-window-body" hidden={view !== 'chat'}>
          <ChatPanel chat={chat} onRequestHelp={onRequestHelp} />
        </div>

        {view === 'help' && (
          <div className="chat-window-scroll">
            <EscalationForm
              key={`${help.question}-${help.sessionId ?? ''}`}
              initialQuestion={help.question}
              sessionId={help.sessionId}
              onClose={onBackToChat}
            />
          </div>
        )}
      </section>

      {!isOpen && (
        <button
          id="chat-launcher"
          type="button"
          className="chat-launcher"
          onClick={onOpen}
          aria-expanded={false}
          aria-controls="chat-window"
          aria-label={unread > 0 ? `Open OfficeLume chat, ${unread} new ${unread === 1 ? 'message' : 'messages'}` : 'Open OfficeLume chat'}
        >
          <svg className="chat-launcher-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path d="M4 7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-6.5L9 24v-5H8a4 4 0 0 1-4-4V7Z" fill="#fff" />
            <circle cx="10" cy="11" r="1.6" fill="#1563d6" />
            <circle cx="14" cy="11" r="1.6" fill="#1563d6" />
            <circle cx="18" cy="11" r="1.6" fill="#1563d6" />
          </svg>
          <span>Ask OfficeLume</span>
          {unread > 0 && (
            <span className="chat-launcher-badge" aria-hidden="true">
              {unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
