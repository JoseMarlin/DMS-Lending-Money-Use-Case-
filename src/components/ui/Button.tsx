import type { ComponentPropsWithRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'dangerGhost';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  /** md is 40px high (footer, forms), sm is 32px (inside rows) */
  size?: ButtonSize;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover border border-transparent',
  secondary: 'bg-white text-label border border-field-border hover:bg-field-disabled',
  // blue outline: the Import button of the master list
  outline: 'bg-white text-primary border border-primary-border hover:bg-primary-50',
  ghost: 'bg-transparent text-primary border border-transparent hover:bg-primary/10',
  // for removing or discarding something
  dangerGhost: 'bg-transparent text-error-text border border-transparent hover:bg-error/10',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-10 px-4',
  sm: 'h-8 px-3',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-field text-button-s whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
