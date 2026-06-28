'use client';

import React, { useEffect, useState } from 'react';
import { lockBodyScroll } from '@/lib/body-scroll-lock';
import { REPORT_REASONS, type ReportReasonId } from '@/lib/community-ugc';

type Props = {
  open: boolean;
  targetLabel: string;
  loading?: boolean;
  onSubmit: (reason: ReportReasonId) => void;
  onClose: () => void;
};

export function CommunityReportModal({
  open,
  targetLabel,
  loading = false,
  onSubmit,
  onClose,
}: Props): React.ReactElement | null {
  const [reason, setReason] = useState<ReportReasonId>('inappropriate');

  useEffect(() => {
    if (!open) return;
    setReason('inappropriate');
    return lockBodyScroll();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="gv-community-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gv-community-report-title"
      onClick={onClose}
    >
      <div className="gv-community-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="gv-community-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="gv-community-report-title" className="gv-community-modal__title">
          Report content
        </h2>
        <p className="gv-community-modal__desc">
          Tell us why you are reporting <strong>{targetLabel}</strong>. Our team reviews flagged content.
        </p>
        <fieldset className="gv-community-report__reasons">
          <legend className="gv-community-report__legend">Reason</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className="gv-community-report__reason">
              <input
                type="radio"
                name="report-reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
                disabled={loading}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </fieldset>
        <div className="gv-community-modal__actions">
          <button type="button" className="gv-community-modal__btn gv-community-modal__btn--ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="gv-community-modal__btn gv-community-modal__btn--danger"
            onClick={() => onSubmit(reason)}
            disabled={loading}
          >
            {loading ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </div>
    </div>
  );
}
