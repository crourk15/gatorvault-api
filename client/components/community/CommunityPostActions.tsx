'use client';

import React from 'react';

type Props = {
  canModerate: boolean;
  isOwnContent: boolean;
  isBlockedAuthor: boolean;
  flagged?: boolean;
  onReport: () => void;
  onBlock: () => void;
  onUnblock?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function CommunityPostActions({
  canModerate,
  isOwnContent,
  isBlockedAuthor,
  flagged,
  onReport,
  onBlock,
  onUnblock,
  onEdit,
  onDelete,
}: Props): React.ReactElement | null {
  const showOwnActions = isOwnContent && Boolean(onEdit || onDelete);
  const showModActions = canModerate && !isOwnContent;
  if (!showOwnActions && !showModActions && !flagged) return null;

  return (
    <div className="gv-community__post-actions">
      {flagged ? (
        <span className="gv-community__flag-badge" title="This content has been reported">
          Reported
        </span>
      ) : null}
      {showOwnActions ? (
        <>
          {onEdit ? (
            <button type="button" className="gv-community__action-btn" onClick={onEdit}>
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="gv-community__action-btn gv-community__action-btn--danger"
              onClick={onDelete}
            >
              Delete
            </button>
          ) : null}
        </>
      ) : null}
      {showModActions ? (
        <>
          <button type="button" className="gv-community__action-btn" onClick={onReport}>
            Report
          </button>
          {isBlockedAuthor ? (
            <button type="button" className="gv-community__action-btn" onClick={onUnblock}>
              Unblock user
            </button>
          ) : (
            <button type="button" className="gv-community__action-btn gv-community__action-btn--danger" onClick={onBlock}>
              Block user
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
