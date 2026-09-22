import { createContext, useContext } from 'react';

export interface ChatWidgetContextValue {
  /** True while the chat window is expanded; false when minimized to the launcher. */
  isOpen: boolean;
  /** Expand the chat window and focus the message box. */
  openChat: () => void;
  /** Expand the window on the human-help form, optionally prefilled from the chat. */
  openHelp: (question?: string, sessionId?: string) => void;
  minimize: () => void;
}

export const ChatWidgetContext = createContext<ChatWidgetContextValue | null>(null);

export function useChatWidget(): ChatWidgetContextValue {
  const value = useContext(ChatWidgetContext);
  if (!value) throw new Error('useChatWidget must be used inside <ChatWidgetProvider>.');
  return value;
}
