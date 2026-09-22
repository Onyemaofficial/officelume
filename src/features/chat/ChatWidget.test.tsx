import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatWidgetProvider } from './ChatWidgetProvider';
import { useChatWidget } from './chatWidgetContext';

const askOfficeLume = vi.fn();
vi.mock('../../services/chatService', () => ({
  askOfficeLume: (...args: unknown[]) => askOfficeLume(...args),
}));
vi.mock('../../services/escalationService', () => ({
  submitEscalation: vi.fn(),
}));

/** Mirrors PublicLayout: the provider sits in a layout route that stays mounted across pages. */
function Layout() {
  return (
    <ChatWidgetProvider>
      <nav>
        <Link to="/a">Go to A</Link>
        <Link to="/b">Go to B</Link>
      </nav>
      <main>
        <Outlet />
      </main>
      <Openers />
    </ChatWidgetProvider>
  );
}

/** Stand-ins for the hero / nav buttons that call into the widget from page content. */
function Openers() {
  const { openChat, openHelp } = useChatWidget();
  return (
    <>
      <button onClick={openChat}>page: ask</button>
      <button onClick={() => openHelp()}>page: human help</button>
    </>
  );
}

function renderApp(initialPath = '/a') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/a" element={<p>Page A content</p>} />
          <Route path="/b" element={<p>Page B content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const launcher = () => screen.queryByRole('button', { name: /^Open OfficeLume chat/ });
const dialog = () => screen.queryByRole('dialog', { name: 'OfficeLume chat assistant' });

async function ask(text: string) {
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

describe('floating chat widget', () => {
  beforeEach(() => {
    askOfficeLume.mockReset();
    sessionStorage.clear();
  });
  afterEach(() => sessionStorage.clear());

  it('starts minimized as a launcher button, with the chat hidden', () => {
    renderApp();
    expect(launcher()).toBeTruthy();
    expect(dialog()).toBeNull();
  });

  it('opens from the launcher and offers a minimize button', () => {
    renderApp();
    fireEvent.click(launcher()!);
    expect(dialog()).toBeTruthy();
    expect(launcher()).toBeNull();
    expect(screen.getByRole('button', { name: 'Minimize chat' })).toBeTruthy();
    expect(screen.getByText(/You are interacting with an AI-assisted receptionist/)).toBeTruthy();
  });

  it('minimizes back to the launcher, and Escape also minimizes', () => {
    renderApp();
    fireEvent.click(launcher()!);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize chat' }));
    expect(dialog()).toBeNull();
    expect(launcher()).toBeTruthy();

    fireEvent.click(launcher()!);
    fireEvent.keyDown(dialog()!, { key: 'Escape' });
    expect(dialog()).toBeNull();
  });

  it('opens from page buttons (hero / nav) and jumps straight to the human-help form', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'page: human help' }));
    expect(screen.getByRole('heading', { name: 'Request human help' })).toBeTruthy();
    expect(within(dialog()!).getByRole('button', { name: /Back to chat/ })).toBeTruthy();

    fireEvent.click(within(dialog()!).getByRole('button', { name: /Back to chat/ }));
    expect(screen.queryByRole('heading', { name: 'Request human help' })).toBeNull();
    expect(screen.getByLabelText('Your question')).toBeTruthy();
  });

  it('"Talk to a person" opens the help form prefilled with the last question', async () => {
    askOfficeLume.mockResolvedValue({ sessionId: 'sess1234567', answer: 'Not sure.', supported: false, requiresEscalation: true, category: 'other' });
    renderApp();
    fireEvent.click(launcher()!);
    await ask('Do you offer a lifetime warranty?');
    await screen.findByText('Not sure.');

    fireEvent.click(screen.getByRole('button', { name: 'Talk to a person' }));
    // Role queries ignore the (hidden) chat input, so this finds only the help form's textarea.
    const question = screen.getByRole('textbox', { name: /^Your question/ }) as HTMLTextAreaElement;
    expect(question.value).toBe('Do you offer a lifetime warranty?');
  });

  it('stays visible, open, and keeps the conversation when navigating to another page', async () => {
    askOfficeLume.mockResolvedValue({ sessionId: 'sess1234567', answer: 'We serve Riverton.', supported: true, requiresEscalation: false, category: 'service_area' });
    renderApp('/a');
    fireEvent.click(launcher()!);
    await ask('What areas do you service?');
    await screen.findByText('We serve Riverton.');

    fireEvent.click(screen.getByRole('link', { name: 'Go to B' }));
    expect(screen.getByText('Page B content')).toBeTruthy();
    expect(dialog()).toBeTruthy();
    expect(screen.getByText('We serve Riverton.')).toBeTruthy();
    expect(askOfficeLume).toHaveBeenCalledTimes(1);
  });

  it('a minimized chat stays minimized across pages, and re-opens with the same conversation', async () => {
    askOfficeLume.mockResolvedValue({ sessionId: 'sess1234567', answer: 'We serve Riverton.', supported: true, requiresEscalation: false, category: 'service_area' });
    renderApp('/a');
    fireEvent.click(launcher()!);
    await ask('What areas do you service?');
    await screen.findByText('We serve Riverton.');
    fireEvent.click(screen.getByRole('button', { name: 'Minimize chat' }));

    fireEvent.click(screen.getByRole('link', { name: 'Go to B' }));
    expect(launcher()).toBeTruthy();
    expect(dialog()).toBeNull();

    fireEvent.click(launcher()!);
    expect(screen.getByText('We serve Riverton.')).toBeTruthy();
    // The same server-side session continues on the next question.
    await ask('And what time do you open?');
    await waitFor(() => expect(askOfficeLume).toHaveBeenCalledTimes(2));
    expect(askOfficeLume.mock.calls[1]?.[1]).toBe('sess1234567');
  });

  it('shows an unread badge when an answer arrives while minimized', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    askOfficeLume.mockReturnValue(new Promise((r) => (resolve = r)));
    renderApp();
    fireEvent.click(launcher()!);
    await ask('What time do you open?');
    fireEvent.click(screen.getByRole('button', { name: 'Minimize chat' }));

    resolve({ sessionId: 'sess1234567', answer: 'Open at 8.', supported: true, requiresEscalation: false, category: 'hours' });
    expect(await screen.findByRole('button', { name: 'Open OfficeLume chat, 1 new message' })).toBeTruthy();

    fireEvent.click(launcher()!);
    expect(screen.getByText('Open at 8.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize chat' }));
    expect(screen.getByRole('button', { name: 'Open OfficeLume chat' })).toBeTruthy();
  });

  it('remembers open/minimized for the browser session (survives a reload)', () => {
    const first = renderApp();
    fireEvent.click(launcher()!);
    first.unmount();

    renderApp();
    expect(dialog()).toBeTruthy();
  });
});
