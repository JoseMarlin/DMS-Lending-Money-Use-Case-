import { MinusIcon, PlusIcon } from '@/components/ui/icons';
import { ZOOM, clampZoom, zoomPercent } from './filesPageModel';

const STEP_BUTTON =
  'flex h-6 w-6 items-center justify-center rounded-full text-label hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent';

/**
 * The size of the file cards: a minus button, a slider and a plus button. At the end of the range a
 * button is aria-disabled, not disabled, so that the cursor does not fall off the page while it is on it
 * (pressing it there changes nothing: the value is kept between the least and the most).
 */
export default function ZoomControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div role="group" aria-label="Card size" className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Smaller cards"
        aria-disabled={value <= ZOOM.min || undefined}
        onClick={() => onChange(clampZoom(value - ZOOM.step))}
        className={STEP_BUTTON}
      >
        <MinusIcon size={14} />
      </button>
      <input
        type="range"
        aria-label="Card size"
        aria-valuetext={`${zoomPercent(value)}%`}
        min={ZOOM.min}
        max={ZOOM.max}
        step={ZOOM.step}
        value={value}
        onChange={(event) => onChange(clampZoom(Number(event.target.value)))}
        className="range-thin h-4 w-24 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <button
        type="button"
        aria-label="Larger cards"
        aria-disabled={value >= ZOOM.max || undefined}
        onClick={() => onChange(clampZoom(value + ZOOM.step))}
        className={STEP_BUTTON}
      >
        <PlusIcon size={14} />
      </button>
    </div>
  );
}
