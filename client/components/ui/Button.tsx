'use client';

import React from 'react';

type Variant = 'primary' | 'secondary';

type BaseProps = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = BaseProps & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

function btnClass(variant: Variant, className?: string): string {
  const base = `gv-btn gv-btn--${variant}`;
  return className ? `${base} ${className}` : base;
}

export function Button(props: ButtonProps | LinkProps): React.ReactElement {
  const { variant = 'primary', className, children } = props;

  if ('href' in props && props.href) {
    const { href, ...rest } = props;
    return (
      <a href={href} className={btnClass(variant, className)} {...rest}>
        {children}
      </a>
    );
  }

  const { ...rest } = props as ButtonProps;
  return (
    <button type="button" className={btnClass(variant, className)} {...rest}>
      {children}
    </button>
  );
}
