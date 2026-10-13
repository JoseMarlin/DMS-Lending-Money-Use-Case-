interface BrandMarkProps {
  /** Only the round mark, for the narrow sidebar */
  compact?: boolean;
}

/**
 * The DMS+ logo as the Figma sidebar shows it: a blue round mark with a folder, "dMACQ" in small
 * type and "DMS+" in bold. Redrawn here from the frame, so it is provisional like the one in the
 * form header: swap it for the real asset when there is one.
 */
export default function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M2.5 6.5A2.5 2.5 0 0 1 5 4h4.3c.6 0 1.2.25 1.6.7L12.2 6H19a2.5 2.5 0 0 1 2.5 2.5V10h-19V6.5Z" />
          <path
            d="M2.5 11.5h19V17.5A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5v-6Z"
            opacity=".9"
          />
        </svg>
      </span>
      {compact ? null : (
        <span className="leading-none text-white">
          <span className="block text-[11px] text-sidebar-brand">
            dMACQ<sup className="ml-px text-[6px]">&reg;</sup>
          </span>
          <span className="block text-lg font-bold">DMS+</span>
        </span>
      )}
    </span>
  );
}
