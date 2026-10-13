/**
 * The small mark on a folder that files were moved into (submitted, approved, rejected) and that has
 * not been opened since. The word is in the pill, so colour is not the only signal. Not in the Figma
 * frame: provisional, built from the tokens of the status chips.
 */
export default function MovedBadge() {
  return (
    <span className="inline-flex h-[18px] shrink-0 items-center rounded-full border border-primary-200 bg-primary-50 px-2 text-[11px] leading-[18px] font-semibold text-primary">
      Moved
      <span className="sr-only">
        {' '}
        (files were moved into this folder and it has not been opened since)
      </span>
    </span>
  );
}
