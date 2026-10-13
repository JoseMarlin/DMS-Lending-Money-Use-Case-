import { useId, useState } from 'react';
import { DEMO_USERS } from '@/data/seed';
import { useAppStore, useCurrentUser } from '@/data/store';
import type { DemoUserId } from '@/data/types';
import { usePopover } from '@/components/ui/usePopover';
import Avatar from './Avatar';
import { CheckIcon, ResetIcon } from './icons';

const ROW_FOCUS =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

/**
 * The avatar in the top bar and the menu it opens. The menu is not in Figma, so it is designed from
 * the same tokens: who you are (name, role, branch), the "Act as" list of the four demo users, and
 * Reset demo. Choosing a user changes the app at once, with no reload.
 */
export default function UserMenu() {
  const user = useCurrentUser();
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);
  const resetDemo = useAppStore((state) => state.resetDemo);
  const { open, toggle, close, rootRef, triggerRef, panelRef } = usePopover();
  const panelId = useId();
  const actAsId = useId();

  // The avatar keeps the cursor after a choice and its name changes in silence, so the change is said
  const [announcement, setAnnouncement] = useState('');

  const actAs = (id: DemoUserId) => {
    close();
    setCurrentUser(id);
    setAnnouncement(`Now acting as ${DEMO_USERS[id].name}, ${DEMO_USERS[id].roleLabel}`);
  };

  return (
    <div ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Account menu for ${user.name}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className="flex rounded-full hover:ring-2 hover:ring-primary/30 aria-expanded:ring-2 aria-expanded:ring-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Avatar name={user.name} />
      </button>

      <span role="status" className="sr-only">
        {announcement}
      </span>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="region"
          aria-label="Account"
          className="absolute top-[calc(100%-4px)] right-5 z-[10000] max-h-[calc(100vh-60px)] w-80 overflow-y-auto rounded-card border border-line bg-white shadow-card"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-body-m text-ink">{user.name}</p>
              <p className="text-xs text-subtle">{user.roleLabel}</p>
              <p className="text-xs text-subtle">{user.branch}</p>
            </div>
          </div>

          <div role="group" aria-labelledby={actAsId} className="border-t border-line py-2">
            <p id={actAsId} className="px-4 pb-1 text-link-s text-label">
              Act as
            </p>
            {Object.values(DEMO_USERS).map((person) => {
              const current = person.id === user.id;
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-current={current ? 'true' : undefined}
                  data-autofocus={current ? '' : undefined}
                  onClick={() => actAs(person.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-primary-50 ${ROW_FOCUS} ${
                    current ? 'bg-primary-50' : ''
                  }`}
                >
                  <Avatar name={person.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-m text-ink">{person.name}</span>{' '}
                    <span className="block truncate text-xs text-subtle">{person.roleLabel}</span>
                  </span>
                  {current ? (
                    <>
                      <CheckIcon size={16} className="shrink-0 text-primary" />{' '}
                      <span className="sr-only">(current)</span>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="border-t border-line py-1">
            <button
              type="button"
              onClick={() => {
                resetDemo();
                close();
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-body-m text-error-text hover:bg-primary-50 ${ROW_FOCUS}`}
            >
              <ResetIcon size={16} className="shrink-0" />
              Reset demo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
