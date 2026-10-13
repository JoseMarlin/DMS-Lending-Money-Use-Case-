import type { ComponentPropsWithRef } from 'react';
import { CONTROL_BASE, controlBorder } from './fieldStyles';

export interface TextInputProps extends ComponentPropsWithRef<'input'> {
  invalid?: boolean;
}

export default function TextInput({ invalid, className = '', ...props }: TextInputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`h-10 ${CONTROL_BASE} ${controlBorder(invalid)} ${className}`}
      {...props}
    />
  );
}
