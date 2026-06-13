'use client';

/**
 * /staff — redirect to staff dashboard.
 */
import React, { useEffect } from 'react';

export default function StaffIndexPage(): React.ReactElement {
  useEffect(() => {
    window.location.replace('/staff/dashboard');
  }, []);

  return (
    <div className="fc-staff-dashboard-wrap">
      <p className="fc-staff-dashboard__status">Loading staff dashboard…</p>
    </div>
  );
}
