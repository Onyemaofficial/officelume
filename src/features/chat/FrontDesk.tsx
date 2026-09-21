import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { EscalationForm } from '../escalations/EscalationForm';
import { ChatPanel } from './ChatPanel';

interface HelpState {
  open: boolean;
  question: string;
  sessionId?: string | undefined;
}

/**
 * The customer "front desk": AI chat plus the human-help form. The form opens from a chat
 * escalation prompt, the "Talk to a person" button, or the `/#help` link on the home page.
 */
export function FrontDesk() {
  const location = useLocation();
  const navigate = useNavigate();
  const [manual, setManual] = useState<HelpState>({ open: false, question: '' });
  const helpRef = useRef<HTMLDivElement>(null);

  const helpOpen = manual.open || location.hash === '#help';

  useEffect(() => {
    if (helpOpen) helpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [helpOpen]);

  function closeHelp() {
    setManual((m) => ({ ...m, open: false }));
    if (location.hash === '#help') navigate('/#ask', { replace: true });
  }

  return (
    <div className="front-desk">
      <ChatPanel onRequestHelp={(question, sessionId) => setManual({ open: true, question, sessionId })} />
      {helpOpen && (
        <div ref={helpRef}>
          <EscalationForm
            key={`${manual.question}-${manual.sessionId ?? ''}`}
            initialQuestion={manual.question}
            sessionId={manual.sessionId}
            onClose={closeHelp}
          />
        </div>
      )}
    </div>
  );
}
