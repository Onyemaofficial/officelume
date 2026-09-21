interface PrivacyNoticeProps {
  purpose: 'service request' | 'human help request';
}

/** Shown before any personal information is collected (spec section 26). */
export function PrivacyNotice({ purpose }: PrivacyNoticeProps) {
  return (
    <aside className="privacy-notice" aria-label="Privacy notice">
      <strong>Before you share your details</strong>
      <ul>
        <li>We collect your contact details only to process your {purpose} and follow up with you.</li>
        <li>OfficeLume is AI-assisted: an AI receptionist may help you along the way.</li>
        <li>An authorized team member will review the information you submit.</li>
      </ul>
    </aside>
  );
}

export const CONSENT_LABEL =
  'I understand that OfficeLume uses AI assistance and that the information I submit will be used to process my service request or connect me with a team member.';
