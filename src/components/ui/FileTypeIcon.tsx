import type { FileKind } from './fileKind';

/**
 * The file icons of the Workflow design (its icon sheet): a pale page with a folded corner and a
 * red PDF label, and a small picture. Drawn here as SVG, a little simpler than the originals. They
 * are only decoration: the file name is always next to them.
 */
export default function FileTypeIcon({
  kind,
  size = 28,
  className,
}: {
  kind: FileKind;
  /** Height in pixels; the icon is a little narrower than it is high */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={(size * 75) / 87}
      height={size}
      viewBox="0 0 75 87"
      className={className}
    >
      {kind === 'pdf' ? (
        <>
          <path
            d="M15 0h39l21 22v62a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3Z"
            fill="var(--color-file-page)"
          />
          <path d="M54 0v19a3 3 0 0 0 3 3h18L54 0Z" fill="var(--color-file-fold)" />
          <rect x="0" y="41" width="64" height="33" rx="5" fill="var(--color-file-pdf)" />
          <text
            x="32"
            y="65"
            textAnchor="middle"
            fontSize="24"
            fontWeight="700"
            fill="#fff"
            style={{ fontFamily: 'inherit' }}
          >
            PDF
          </text>
        </>
      ) : kind === 'doc' ? (
        <>
          <path
            d="M15 0h39l21 22v62a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3Z"
            fill="var(--color-file-page)"
          />
          <path d="M54 0v19a3 3 0 0 0 3 3h18L54 0Z" fill="var(--color-file-fold)" />
          <rect x="0" y="41" width="64" height="33" rx="5" fill="var(--color-file-doc)" />
          <text
            x="32"
            y="65"
            textAnchor="middle"
            fontSize="22"
            fontWeight="700"
            fill="#fff"
            style={{ fontFamily: 'inherit' }}
          >
            DOC
          </text>
        </>
      ) : (
        <>
          <rect x="5" y="14" width="65" height="59" rx="9" fill="var(--color-file-image)" />
          <path
            d="M5 62c10-14 18-20 27-20s16 8 24 6c6-1.500 10 3 14 8v9a9 9 0 0 1-9 8H14a9 9 0 0 1-9-9v-2Z"
            fill="var(--color-file-hill)"
          />
          <path
            d="M5 66c12-9 20-12 30-6 9 5 20 6 35-2v9a9 9 0 0 1-9 8H14a9 9 0 0 1-9-9v-0Z"
            fill="var(--color-file-hill-dark)"
          />
          <circle cx="52" cy="31" r="7" fill="#fff" />
        </>
      )}
    </svg>
  );
}
