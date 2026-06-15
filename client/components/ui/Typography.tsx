'use client';

import React from 'react';

type Tag = keyof JSX.IntrinsicElements;

function makeHeading(tag: Tag, className: string) {
  return function Heading({
    children,
    className: extra,
    ...rest
  }: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }): React.ReactElement {
    return React.createElement(tag, { className: extra ? `${className} ${extra}` : className, ...rest }, children);
  };
}

export const HeadingXL = makeHeading('h1', 'gv-heading-xl');
export const HeadingL = makeHeading('h2', 'gv-heading-l');
export const HeadingM = makeHeading('h3', 'gv-heading-m');
export const BodyL = makeHeading('p', 'gv-body-l');
export const BodyM = makeHeading('p', 'gv-body-m');
export const Label = makeHeading('span', 'gv-label');
