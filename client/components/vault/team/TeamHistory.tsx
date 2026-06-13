import React from 'react';

export function TeamHistory(): React.ReactElement {
  return (
    <>
      <h3 className="gv-team-subhdr">Program History</h3>
      <div className="gv-hscroll-wrap gv-team-hscroll-wrap">
        <div id="gv-team-eras-track" className="gv-team-eras-track" data-gv-hscroll="1" />
      </div>
    </>
  );
}
