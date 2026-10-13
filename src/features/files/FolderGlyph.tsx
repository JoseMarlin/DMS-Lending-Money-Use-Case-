/**
 * The orange folder on the panel of a folder card (Figma node 299:6140: about 34 by 27 pixels).
 * Decoration only: the folder's name is next to it.
 */
export default function FolderGlyph({ width = 34 }: { width?: number }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={width}
      height={(width * 27) / 34}
      viewBox="0 0 34 27"
      fill="none"
    >
      <path
        d="M2 3.5A2.5 2.5 0 0 1 4.5 1h8.2c.7 0 1.3.3 1.8.8L16.6 4H29.5A2.5 2.5 0 0 1 32 6.5V22.5A2.5 2.5 0 0 1 29.5 25h-25A2.5 2.5 0 0 1 2 22.5V3.5Z"
        fill="var(--color-folder-back)"
      />
      <rect x="0" y="8" width="34" height="19" rx="3" fill="var(--color-folder)" />
    </svg>
  );
}
