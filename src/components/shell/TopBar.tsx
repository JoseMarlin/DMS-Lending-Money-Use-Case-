import NotificationsMenu from './NotificationsMenu';
import UserMenu from './UserMenu';
import { HelpIcon, SearchIcon, SparkleIcon } from './icons';

const ICON_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * The top bar of the app shell (Figma node 5904:14434): 56px, white, with a line under it. The
 * search box, QAI and help are only drawn, as the brief says: they do nothing. The bar is `relative`
 * so the dropdowns of the bell and the avatar hang from it and end at the same right edge.
 * The icon buttons are 32px with a 24px icon, 8px apart: the drawn icons end up about 16px apart,
 * as in the design.
 */
export default function TopBar() {
  return (
    <header className="relative flex h-header shrink-0 items-center justify-between gap-4 border-b border-line bg-white px-5">
      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="flex max-w-xl min-w-0 flex-1 items-center gap-2.5 rounded-field focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
      >
        <SearchIcon size={18} className="shrink-0 text-subtle" />
        <input
          type="text"
          name="search"
          autoComplete="off"
          aria-label="Search files, folders, metadata and more"
          placeholder="Search files, folders, metadata & etc..."
          className="h-10 min-w-0 flex-1 bg-transparent text-body-m text-ink outline-none placeholder:text-subtle"
        />
      </form>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md border border-field-border px-2.5 text-button-s text-ink hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <SparkleIcon size={18} />
          QAI
        </button>
        <button type="button" aria-label="Help" className={ICON_BUTTON}>
          <HelpIcon size={24} />
        </button>
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
