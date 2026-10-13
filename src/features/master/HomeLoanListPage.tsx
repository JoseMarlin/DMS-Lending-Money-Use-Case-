import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Tabs, tabPanelProps } from '@/components/ui';
import { PlusIcon } from '@/components/ui/icons';
import { hasBeenSubmitted, isBlankDraft } from '@/data/application';
import { can } from '@/data/roles';
import { ApplicationStatus } from '@/data/types';
import { useAppStore, useCurrentUser } from '@/data/store';
import { usePageTitle } from '@/lib/usePageTitle';
import AllRecordsPanel from './AllRecordsPanel';
import Breadcrumb from './Breadcrumb';
import MySubmissionsPanel from './MySubmissionsPanel';
import { RECORD_LIST_PATH } from './paths';
import RecordSheet from './record/RecordSheet';
import { DEFAULT_SHEET_TAB, isSheetTab, type SheetTabId } from './record/recordSheetModel';

const TABS = [
  { id: 'all-records', label: 'All Records' },
  { id: 'my-submissions', label: 'My Submissions' },
];
const PREFIX = 'home-loan-list';

/**
 * /metadata/master/home-loan: the Home Loan Application master, laid out like the Employee
 * Onboarding list in the Figma frame (5904:14434). Two tabs: My Submissions (the default), and All
 * Records, which fills only when an application gets its final approval. The tab is kept in the
 * address (?tab=all-records), so coming back from a record lands on the same tab.
 */
export default function HomeLoanListPage() {
  usePageTitle('Home Loan Application');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const draft = useAppStore((state) => state.draft);
  const startNewDraft = useAppStore((state) => state.startNewDraft);

  const tab = params.get('tab') === 'all-records' ? 'all-records' : 'my-submissions';
  const setTab = (id: string) =>
    setParams(id === 'my-submissions' ? {} : { tab: id }, { replace: true });

  // The record sheet is open while the address has ?record=HL-2026-0001 (and ?section= for its tab)
  const recordId = params.get('record') ?? '';
  const section = params.get('section');
  const sheetTab: SheetTabId = isSheetTab(section) ? section : DEFAULT_SHEET_TAB;
  const changeParams = (change: (next: URLSearchParams) => void) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        change(next);
        return next;
      },
      { replace: true },
    );
  const closeSheet = () =>
    changeParams((next) => {
      next.delete('record');
      next.delete('section');
    });
  const changeSheetTab = (id: SheetTabId) =>
    changeParams((next) => {
      if (id === DEFAULT_SHEET_TAB) next.delete('section');
      else next.set('section', id);
    });

  // A record is started from the form at /apply. A form that is empty, was already submitted, or
  // holds an application that was returned (that one is corrected in its record, then resubmitted) is
  // made new for the user who is acting now; one that is half filled is carried on.
  const createRecord = () => {
    if (
      hasBeenSubmitted(draft.status) ||
      draft.status === ApplicationStatus.Returned ||
      isBlankDraft(draft)
    ) {
      startNewDraft();
    }
    navigate('/apply');
  };

  return (
    <div className="px-5 pt-5 pb-6">
      {/* inert while the sheet is open: nothing behind it can be reached or read */}
      <div inert={recordId ? true : undefined}>
        <div className="flex items-start justify-between gap-4">
          <Breadcrumb
            crumbs={[
              { label: 'Metadata', to: RECORD_LIST_PATH },
              { label: 'Master', to: RECORD_LIST_PATH },
              { label: 'Home Loan Application' },
            ]}
          />
          <div className="flex shrink-0 items-center gap-2">
            {/* Import is only drawn, as in the brief */}
            <Button variant="outline">Import</Button>
            {can(user.role, 'createApplication') ? (
              <Button onClick={createRecord}>
                <PlusIcon size={18} />
                Create Record
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2">
          <Tabs
            tabs={TABS}
            value={tab}
            onChange={setTab}
            label="Home Loan Application views"
            idPrefix={PREFIX}
          />
        </div>

        <div
          {...tabPanelProps(PREFIX, tab)}
          className="mt-4 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {tab === 'all-records' ? <AllRecordsPanel /> : <MySubmissionsPanel />}
        </div>
      </div>

      {recordId ? (
        <RecordSheet
          key={recordId}
          applicationId={recordId}
          tab={sheetTab}
          onTabChange={changeSheetTab}
          onClose={closeSheet}
        />
      ) : null}
    </div>
  );
}
