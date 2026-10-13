import { ACTION_LABELS, actionsOf } from '@/data/roles';
import { useCurrentUser } from '@/data/store';
import PlaceholderPage from './PlaceholderPage';

/**
 * Placeholder for the dashboard. It already shows who is acting and what that role can do in the
 * demo, so switching the user in the top bar can be seen here without a reload.
 */
export default function DashboardPage() {
  const user = useCurrentUser();
  return (
    <PlaceholderPage title="Dashboard" note="The dashboard itself is built in a later step.">
      <section
        aria-labelledby="dashboard-signed-in"
        className="mt-6 max-w-xl rounded-card border border-line p-4"
      >
        <h2 id="dashboard-signed-in" className="text-link-s text-label">
          Signed in as {user.name}
        </h2>
        <p className="text-sm text-subtle">
          {user.roleLabel} &middot; {user.branch}
        </p>
        <h3 className="mt-4 text-link-s text-label">In this demo you can</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-body-m text-ink">
          {actionsOf(user.role).map((action) => (
            <li key={action}>{ACTION_LABELS[action]}</li>
          ))}
        </ul>
      </section>
    </PlaceholderPage>
  );
}
