import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/errors';
import { ServiceRequestForm } from './ServiceRequestForm';

const submitServiceRequest = vi.fn();
vi.mock('../../services/serviceRequestService', () => ({
  submitServiceRequest: (...args: unknown[]) => submitServiceRequest(...args),
}));

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fillValidForm() {
  const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  type(/Full name/, 'Jordan Rivera');
  type(/Phone number/, '(555) 010-2345');
  type(/Email address/, 'jordan@example.com');
  type(/Service address/, '12 Elm Street');
  type(/^City/, 'Riverton');
  type(/ZIP code/, '40101');
  type(/Service type/, 'ac_repair');
  type(/Describe the issue/, 'The AC is blowing warm air since yesterday.');
  type(/Preferred date/, tomorrowIso());
  type(/Preferred time window/, 'morning');
  fireEvent.click(screen.getByLabelText('Phone call'));
  fireEvent.click(screen.getByRole('checkbox', { name: /I understand that OfficeLume uses AI assistance/ }));
}

function setup() {
  render(
    <MemoryRouter>
      <ServiceRequestForm />
    </MemoryRouter>,
  );
}

describe('ServiceRequestForm', () => {
  beforeEach(() => {
    submitServiceRequest.mockReset();
  });

  it('shows the privacy notice and AI-assistance consent before collecting personal data', () => {
    setup();
    expect(screen.getByLabelText('Privacy notice')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /OfficeLume uses AI assistance/ })).toBeTruthy();
  });

  it('blocks submission and shows field errors when required fields are empty', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Submit service request/ }));
    expect(await screen.findByText('Name is required.')).toBeTruthy();
    expect(screen.getByText(/acknowledge the privacy notice/i)).toBeTruthy();
    expect(submitServiceRequest).not.toHaveBeenCalled();
  });

  it('submits a valid request and shows the reference number without promising an appointment', async () => {
    submitServiceRequest.mockResolvedValue({ requestNumber: 'SR-2026-000042' });
    setup();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /Submit service request/ }));

    expect(await screen.findByText('Your service request has been received.')).toBeTruthy();
    expect(screen.getByText('SR-2026-000042')).toBeTruthy();
    expect(screen.getByText(/not a guaranteed appointment/i)).toBeTruthy();
    expect(submitServiceRequest).toHaveBeenCalledTimes(1);
    const payload = submitServiceRequest.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['customerName']).toBe('Jordan Rivera');
    expect(payload['consent']).toBe(true);
  });

  it('shows a friendly error when the server rejects the request', async () => {
    submitServiceRequest.mockImplementation(() => Promise.reject(new AppError('unavailable', 'OfficeLume is temporarily unavailable. Please try again in a moment.')));
    setup();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /Submit service request/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('Your service request has been received.')).toBeNull();
  });
});
