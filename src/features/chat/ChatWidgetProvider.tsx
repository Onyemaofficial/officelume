import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChatWidget, type HelpContext, type WidgetView } from './ChatWidget';
import { ChatWidgetContext, type ChatWidgetContextValue } from './chatWidgetContext';
import { useChat } from './useChat';

const STORAGE_KEY = 'officelume.chat.open';

function readStoredOpen(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // storage blocked (private mode etc.) - start minimized
  }
}

function storeOpen(open: boolean) {
  try {
    sessionStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  } catch {
    // non-essential convenience; ignore
  }
}

function focusSoon(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
}

/**
 * Owns the chat conversation and the widget's open/minimized state. It is mounted by the public
 * layout, which stays mounted across route changes - so the conversation, the human-help draft,
 * and the minimized/expanded choice all survive navigating between public pages.
 * The choice also survives a page reload for the browser session. Default: minimized.
 */
export function ChatWidgetProvider({ children }: { children: ReactNode }) {
  const chat = useChat();
  const [isOpen, setIsOpen] = useState(readStoredOpen);
  const [view, setView] = useState<WidgetView>('chat');
  const [help, setHelp] = useState<HelpContext>({ question: '' });
  const [seenCount, setSeenCount] = useState(chat.messages.length);

  const messageCount = chat.messages.length;

  const openChat = useCallback(() => {
    setIsOpen(true);
    setView('chat');
    setSeenCount(messageCount);
    storeOpen(true);
    focusSoon('chat-input');
  }, [messageCount]);

  const openHelp = useCallback(
    (question = '', sessionId?: string) => {
      setHelp({ question, sessionId });
      setView('help');
      setIsOpen(true);
      setSeenCount(messageCount);
      storeOpen(true);
      focusSoon('help-title');
    },
    [messageCount],
  );

  const backToChat = useCallback(() => {
    setView('chat');
    focusSoon('chat-input');
  }, []);

  const minimize = useCallback(() => {
    setIsOpen(false);
    setSeenCount(messageCount);
    storeOpen(false);
    focusSoon('chat-launcher');
  }, [messageCount]);

  // Assistant replies that arrived while minimized show as a badge on the launcher.
  const unread = isOpen ? 0 : chat.messages.slice(seenCount).filter((m) => m.role === 'assistant').length;

  const value = useMemo<ChatWidgetContextValue>(() => ({ isOpen, openChat, openHelp, minimize }), [isOpen, openChat, openHelp, minimize]);

  return (
    <ChatWidgetContext.Provider value={value}>
      {children}
      <ChatWidget
        isOpen={isOpen}
        view={view}
        chat={chat}
        help={help}
        unread={unread}
        onOpen={openChat}
        onMinimize={minimize}
        onRequestHelp={openHelp}
        onBackToChat={backToChat}
      />
    </ChatWidgetContext.Provider>
  );
}
