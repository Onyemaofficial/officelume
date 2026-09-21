import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/errors';
import { ChatPanel } from './ChatPanel';

const askOfficeLume = vi.fn();
vi.mock('../../services/chatService', () => ({
  askOfficeLume: (...args: unknown[]) => askOfficeLume(...args),
}));

function setup() {
  const onRequestHelp = vi.fn();
  render(
    <MemoryRouter>
      <ChatPanel onRequestHelp={onRequestHelp} />
    </MemoryRouter>,
  );
  return { onRequestHelp };
}

async function ask(text: string) {
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

describe('ChatPanel', () => {
  beforeEach(() => {
    askOfficeLume.mockReset();
  });

  it('discloses that the receptionist is AI-assisted', () => {
    setup();
    expect(screen.getByText(/You are interacting with an AI-assisted receptionist/)).toBeTruthy();
    expect(screen.getByText(/OfficeLume \(AI\)/)).toBeTruthy();
  });

  it('shows a supported answer without an escalation prompt', async () => {
    askOfficeLume.mockResolvedValue({
      sessionId: 'sess1234567',
      answer: 'We serve Riverton and Oak Hollow.',
      supported: true,
      requiresEscalation: false,
      category: 'service_area',
    });
    setup();
    await ask('What areas do you service?');
    expect(await screen.findByText('We serve Riverton and Oak Hollow.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Request Human Help' })).toBeNull();
    expect(askOfficeLume).toHaveBeenCalledWith('What areas do you service?', undefined);
  });

  it('offers human escalation for an unsupported answer and passes the original question', async () => {
    askOfficeLume.mockResolvedValue({
      sessionId: 'sess1234567',
      answer: "I don't have enough approved information to answer that accurately. I can send your request to a team member.",
      supported: false,
      requiresEscalation: true,
      category: 'other',
    });
    const { onRequestHelp } = setup();
    await ask('Do you offer a lifetime warranty?');

    const request = await screen.findByRole('button', { name: 'Request Human Help' });
    expect(screen.getByRole('button', { name: 'Continue Chatting' })).toBeTruthy();
    fireEvent.click(request);
    expect(onRequestHelp).toHaveBeenCalledWith('Do you offer a lifetime warranty?', 'sess1234567');
  });

  it('lets the customer dismiss the escalation prompt and keep chatting', async () => {
    askOfficeLume.mockResolvedValue({ sessionId: 's1234567890', answer: 'Not sure.', supported: false, requiresEscalation: true, category: 'other' });
    setup();
    await ask('Something odd');
    fireEvent.click(await screen.findByRole('button', { name: 'Continue Chatting' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Request Human Help' })).toBeNull());
  });

  it('degrades gracefully when the AI service is unavailable (NFR-03)', async () => {
    askOfficeLume.mockImplementation(async () => {
      throw new AppError('unavailable', 'OfficeLume is temporarily unavailable. Please try again in a moment.');
    });
    setup();
    await ask('What time do you open?');
    expect(await screen.findByText(/having trouble reaching our system/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request Human Help' })).toBeTruthy();
    expect(screen.queryByText(/stack|undefined|TypeError/i)).toBeNull();
  });

  it('validates input before calling the server', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: '<script>alert(1)</script>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(askOfficeLume).not.toHaveBeenCalled();
  });

  it('shows a loading state while the AI is working', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    askOfficeLume.mockReturnValue(new Promise((r) => (resolve = r)));
    setup();
    await ask('What time do you open?');
    expect(await screen.findByText(/Checking our approved information/)).toBeTruthy();
    resolve({ sessionId: 'sess1234567', answer: 'Open 8 AM.', supported: true, requiresEscalation: false, category: 'hours' });
    expect(await screen.findByText('Open 8 AM.')).toBeTruthy();
  });
});
