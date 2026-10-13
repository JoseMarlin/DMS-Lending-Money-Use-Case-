import { initialsOf } from '@/lib/format';

const SIZES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
} as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
}

/** Round avatar with the initials of a name, as in the Figma top bar. The name is read elsewhere. */
export default function Avatar({ name, size = 'md' }: AvatarProps) {
  return (
    <span
      aria-hidden
      data-testid="avatar"
      className={`flex shrink-0 items-center justify-center rounded-full bg-avatar font-bold text-ink ${SIZES[size]}`}
    >
      {initialsOf(name)}
    </span>
  );
}
