import type { TextareaHTMLAttributes } from 'react';
import { CONTROL_BASE, controlBorder } from './fieldStyles';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export default function TextArea({ invalid, className = '', ...props }: TextAreaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={`h-[92px] resize-none py-2 ${CONTROL_BASE} ${controlBorder(invalid)} ${className}`}
      {...props}
    />
  );
}
