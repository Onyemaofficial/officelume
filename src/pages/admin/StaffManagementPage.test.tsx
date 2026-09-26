import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthTestProvider, makeAuth, makeProfile } from '../../test/authTestUtils';
import { AppError } from '../../utils/errors';
import { StaffManagementPage } from './StaffManagementPage';

const listStaff = vi.fn();
const createStaff = vi.fn();
const changeStaffRole = vi.fn();
const setStaffActive = vi.fn();
const sendPasswordSetupEmail = vi.fn();

vi.mock('../../services/staffService', () => ({
  listStaff: (...a: unknown[]) => listStaff(...a),
  createStaff: (...a: unknown[]) => createStaff(...a),
  changeStaffRole: (...a: unknown[]) => changeStaffRole(...a),
  setStaffActive: (...a: unknown[]) => setStaffActive(...a),
}));
vi.mock('../../services/authService', () => ({
  sendPasswordSetupEmail: (...a: unknown[]) => sendPasswordSetupEmail(...a),
}));

const people = [
  makeProfile({ uid: 'me', displayName: 'Alex Admin', email: 'alex@example.com', role: 'admin', lastLoginAt: new Date('2026-02-01T09:00:00Z') }),
  makeProfile({ uid: 's1', displayName: 'Pat Lee', email: 'pat@example.com', role: 'staff' }),
  makeProfile({ uid: 's2', displayName: 'Sam Old', email: 'sam@example.com', role: 'staff', active: false }),
];

function renderPage() {
  const auth = makeAuth('admin', { user: { uid: 'me', email: 'alex@example.com', displayName: 'Alex Admin' } });
  return render(
    <AuthTestProvider value={auth}>
      <MemoryRouter>
        <StaffManagementPage />
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

const rowFor = (name: string) => screen.getByText(name, { selector: 'strong' }).closest('tr') as HTMLElement;

describe('staff management (admin only page)', () => {
  beforeEach(() => {
    listStaff.mockReset().mockResolvedValue(people);
    createStaff.mockReset().mockResolvedValue({ uid: 'new1' });
    changeStaffRole.mockReset().mockResolvedValue({ role: 'admin' });
    setStaffActive.mockReset().mockResolvedValue({ active: false });
    sendPasswordSetupEmail.mockReset().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists staff with name, email, role, status, created and last login', async () => {
    renderPage();
    expect(await screen.findByText('Pat Lee', { selector: 'strong' })).toBeTruthy();
    const row = rowFor('Pat Lee');
    expect(within(row).getByText('pat@example.com')).toBeTruthy();
    expect(within(row).getByText('Staff')).toBeTruthy();
    expect(within(row).getByText('Active')).toBeTruthy();
    expect(within(row).getByText('Never')).toBeTruthy(); // never signed in
    expect(within(rowFor('Sam Old')).getByText('Inactive')).toBeTruthy();
    expect(within(rowFor('Alex Admin')).getByText('Administrator')).toBeTruthy();
  });

  it('protects the signed-in administrator from changing their own role or deactivating themselves', async () => {
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    const self = rowFor('Alex Admin');
    expect(within(self).getByText('(you)')).toBeTruthy();
    expect((within(self).getByRole('button', { name: /Make staff/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(self).getByRole('button', { name: /Deactivate/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(rowFor('Pat Lee')).getByRole('button', { name: /Make admin/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('validates the add-staff form before calling the server', async () => {
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Add staff member' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Full name is required.')).toBeTruthy();
    expect(screen.getByText('Email address is required.')).toBeTruthy();
    expect(createStaff).not.toHaveBeenCalled();
  });

  it('creates a staff member and emails a password-setup link (no password is ever entered)', async () => {
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Add staff member' }));
    expect(screen.queryByLabelText(/password/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Jo Nguyen' } });
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'Jo.Nguyen@Example.com' } });
    fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(createStaff).toHaveBeenCalledWith({ displayName: 'Jo Nguyen', email: 'jo.nguyen@example.com', role: 'admin' }));
    await waitFor(() => expect(sendPasswordSetupEmail).toHaveBeenCalledWith('jo.nguyen@example.com'));
    expect(await screen.findByText(/A password setup email was sent to jo\.nguyen@example\.com/)).toBeTruthy();
    expect(listStaff).toHaveBeenCalledTimes(2); // reloaded
  });

  it('keeps the new account but offers a resend when the setup email fails', async () => {
    sendPasswordSetupEmail.mockRejectedValueOnce(new AppError('unavailable', 'x'));
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Add staff member' }));
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Jo Nguyen' } });
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'jo@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/could not be sent/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resend setup email' }));
    await waitFor(() => expect(sendPasswordSetupEmail).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Password setup email sent to jo@example.com.')).toBeTruthy();
  });

  it('shows the server message when creation is refused (e.g. duplicate email)', async () => {
    createStaff.mockRejectedValueOnce(new AppError('conflict', 'An account with that email address already exists.'));
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Add staff member' }));
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Pat Two' } });
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'pat@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('An account with that email address already exists.')).toBeTruthy();
    expect(sendPasswordSetupEmail).not.toHaveBeenCalled();
  });

  it('changes a role after confirmation', async () => {
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    fireEvent.click(within(rowFor('Pat Lee')).getByRole('button', { name: /Make admin/ }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(changeStaffRole).toHaveBeenCalledWith('s1', 'admin'));
    expect(await screen.findByText('Pat Lee is now Administrator.')).toBeTruthy();
  });

  it('does nothing when the confirmation is declined', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    fireEvent.click(within(rowFor('Pat Lee')).getByRole('button', { name: /Deactivate/ }));
    fireEvent.click(within(rowFor('Pat Lee')).getByRole('button', { name: /Make admin/ }));
    expect(setStaffActive).not.toHaveBeenCalled();
    expect(changeStaffRole).not.toHaveBeenCalled();
  });

  it('deactivates and reactivates staff', async () => {
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    fireEvent.click(within(rowFor('Pat Lee')).getByRole('button', { name: /Deactivate/ }));
    await waitFor(() => expect(setStaffActive).toHaveBeenCalledWith('s1', false));
    expect(await screen.findByText('Pat Lee has been deactivated.')).toBeTruthy();

    fireEvent.click(within(rowFor('Sam Old')).getByRole('button', { name: /Reactivate/ }));
    await waitFor(() => expect(setStaffActive).toHaveBeenCalledWith('s2', true));
  });

  it('surfaces a server refusal such as "last administrator" without crashing', async () => {
    changeStaffRole.mockRejectedValueOnce(new AppError('conflict', 'At least one active administrator must remain.'));
    renderPage();
    await screen.findByText('Pat Lee', { selector: 'strong' });
    fireEvent.click(within(rowFor('Pat Lee')).getByRole('button', { name: /Make admin/ }));
    expect(await screen.findByText('At least one active administrator must remain.')).toBeTruthy();
  });
});
