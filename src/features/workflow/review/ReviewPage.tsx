import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Tabs, tabPanelProps, useToast } from '@/components/ui';
import { filesNoticeFor } from '@/data/fileRecords';
import { useAppStore, useCurrentUser } from '@/data/store';
import { folderLink } from '@/features/files/filesPageModel';
import { actionBlock } from '@/data/workflow';
import { usePageTitle } from '@/lib/usePageTitle';
import ActivityLog from './ActivityLog';
import FilesTab from './FilesTab';
import ProgressPanel from './ProgressPanel';
import RecordDetails from './RecordDetails';
import ReviewHeader from './ReviewHeader';
import ReviewTopBar from './ReviewTopBar';
import SubmissionPanel from './SubmissionPanel';
import TakeActionDialog from './TakeActionDialog';
import { activityEntries } from './activityModel';
import {
  applicationOfInstance,
  blockMessage,
  detailSections,
  kycBlock,
  levelOneDecision,
  progressSteps,
  submissionItems,
} from './reviewModel';

const PREFIX = 'review';

const TABS = [
  { id: 'details', label: 'Record Details' },
  { id: 'activity', label: 'Activity log' },
  { id: 'files', label: 'Files' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const isTab = (value: string | null): value is TabId => TABS.some((tab) => tab.id === value);

/** What the screen says for an address that is no instance. */
function NotFound({ instanceId }: { instanceId: string }) {
  return (
    <div className="flex h-screen flex-col bg-white">
      <ReviewTopBar workflowName="Home Loan Approval" />
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-heading-s text-label">This workflow request was not found</h1>
        <p className="max-w-md text-body-m text-subtle">
          There is no request {instanceId ? `"${instanceId}"` : 'with this address'}. It may belong
          to a demo that was reset.
        </p>
        <Link
          to="/workflow"
          className="mt-2 text-button-s text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to Workflow
        </Link>
      </main>
    </div>
  );
}

/**
 * /workflow/review/:instanceId: the full-screen review of one workflow instance (Figma Workflow
 * file, node 2613:30827). A dark bar, the user's pending submissions on the left, the application in
 * the centre (Record Details, Activity log and Files tabs) and the Progress panel on the right.
 * Take Action opens the dialog; a decision sends the user back to /workflow with a toast.
 */
export default function ReviewPage() {
  const { instanceId = '' } = useParams();
  const user = useCurrentUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const applications = useAppStore((state) => state.applications);
  const masterRecords = useAppStore((state) => state.masterRecords);
  const workflowInstances = useAppStore((state) => state.workflowInstances);
  const auditEvents = useAppStore((state) => state.auditEvents);
  const notifications = useAppStore((state) => state.notifications);
  const [query, setQuery] = useState('');
  // the id of the request the Take Action dialog is open for, or null
  const [actionFor, setActionFor] = useState<string | null>(null);
  // another request on screen (Back, Forward, the Submission panel): the dialog does not come along
  if (actionFor !== null && actionFor !== instanceId) setActionFor(null);

  const instance = workflowInstances.find((i) => i.id === instanceId);
  const application = instance
    ? applicationOfInstance({ applications, masterRecords }, instance)
    : undefined;

  usePageTitle(instance ? `Review ${instance.id}` : 'Review');

  const requested = params.get('tab');
  const tab: TabId = isTab(requested) ? requested : 'details';
  const setTab = (id: string) => setParams(id === 'details' ? {} : { tab: id }, { replace: true });

  const data = { applications, masterRecords, workflowInstances, auditEvents, notifications };
  const block = instance ? actionBlock(data, instance.id, user) : null;
  const items = submissionItems(data, user, query);
  const steps = instance ? progressSteps(instance, block === null) : [];

  if (!instance) return <NotFound instanceId={instanceId} />;

  return (
    <div className="flex h-screen flex-col bg-white">
      <ReviewTopBar workflowName={instance.workflowName} />
      <div className="flex min-h-0 flex-1">
        <SubmissionPanel
          items={items}
          currentId={instance.id}
          query={query}
          onQueryChange={setQuery}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <ReviewHeader
            instance={instance}
            applicantName={application?.fullNameAsPerPan ?? ''}
            kycException={application?.kycOverallResult === 'Exception'}
            blockedReason={block ? blockMessage(block, instance) : null}
            onTakeAction={() => setActionFor(instance.id)}
          />
          <div className="mt-2.5 shrink-0 border-b border-line px-5">
            <Tabs
              tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
              value={tab}
              onChange={setTab}
              label="Review views"
              idPrefix={PREFIX}
              size="sm"
              flush
            />
          </div>
          <div
            {...tabPanelProps(PREFIX, tab)}
            // another submission starts at the top again; `relative` keeps visually hidden text (sr-only
            // is absolutely positioned) inside the scrolling area instead of stretching the page
            key={instance.id}
            className="thin-scrollbar relative min-h-0 flex-1 overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            {tab === 'activity' ? (
              <ActivityLog entries={activityEntries(auditEvents, instance.applicationId)} />
            ) : !application ? (
              <p className="px-5 pt-6 text-body-m text-subtle">
                The application {instance.applicationId} is not in this demo any more.
              </p>
            ) : tab === 'files' ? (
              <FilesTab application={application} />
            ) : (
              <RecordDetails
                sections={detailSections(application)}
                kyc={kycBlock(application)}
                levelOne={levelOneDecision(instance, user)}
              />
            )}
          </div>
        </main>

        <ProgressPanel steps={steps} />
      </div>

      {actionFor === instance.id && application ? (
        <TakeActionDialog
          key={instance.id}
          instance={instance}
          application={application}
          user={user}
          onClose={() => setActionFor(null)}
          onDone={(message) => {
            // the store has the new state: the lists, the bell and this screen follow it by themselves
            setActionFor(null);
            toast.show({ tone: 'success', message });
            // a final approval files the application's files, a rejection holds them: say where
            const decided = useAppStore
              .getState()
              .applications.find((a) => a.applicationId === application.applicationId);
            const notice = decided ? filesNoticeFor(decided) : null;
            if (notice) {
              toast.show({
                tone: 'info',
                message: notice.message,
                action: {
                  label: 'Open folder',
                  onClick: () => navigate(folderLink(notice.folderId)),
                },
              });
            }
            navigate('/workflow');
          }}
        />
      ) : null}
    </div>
  );
}
