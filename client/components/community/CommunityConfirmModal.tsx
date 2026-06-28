'use client';

import React, { useEffect } from 'react';
import { lockBodyScroll } from '@/lib/body-scroll-lock';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CommunityConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmTone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: Props): React.ReactElement | null {
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="gv-community-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gv-community-confirm-title"
      onClick={onCancel}
    >
      <div className="gv-community-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="gv-community-modal__close" onClick={onCancel} aria-label="Close">
          ×
        </button>
        <h2 id="gv-community-confirm-title" className="gv-community-modal__title">
          {title}
        </h2>
        {description ? <p className="gv-community-modal__desc">{description}</p> : null}
        <div className="gv-community-modal__actions">
          <button type="button" className="gv-community-modal__btn gv-community-modal__btn--ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`gv-community-modal__btn gv-community-modal__btn--${confirmTone}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
