import { SEED_APPLICATIONS } from '@/data/seed';
import { buildSeedWorkflow } from '@/data/seedWorkflow';
import { DEMO_USERS } from '@/data/users';
import type { WorkflowData } from '@/data/workflow';
import {
  filterRows,
  reviewPath,
  rowMeta,
  rowTitle,
  rowsByTab,
  sortRows,
  tabLabel,
} from './workflowList';

const { priya, mahesh, sunita, admin } = DEMO_USERS;

function seed(): WorkflowData {
  const applications = structuredClone(SEED_APPLICATIONS);
  return { applications, masterRecords: [], ...buildSeedWorkflow(applications) };
}

const names = (rows: ReturnType<typeof rowsByTab>['all']) => rows.map((r) => r.applicantName);

describe('what each tab holds, for each user, at the start', () => {
  // seven applications, but the seventh (Prakash Naik) is a draft: it was never submitted, so it has no workflow
  it('Mahesh: one action, five completed, all six', () => {
    const tabs = rowsByTab(seed(), mahesh);
    expect(names(tabs['my-actions'])).toEqual(['Manjunath Hiremath']);
    expect(names(tabs.completed).sort()).toEqual([
      'Basavaraj Kadam',
      'Meera Joshi',
      'Savita Patil',
      'Shobha Gaonkar',
      'Vijay Kulkarni',
    ]);
    expect(tabs.all).toHaveLength(6);
  });

  it('Sunita: one action, three completed, all six', () => {
    const tabs = rowsByTab(seed(), sunita);
    expect(names(tabs['my-actions'])).toEqual(['Shobha Gaonkar']);
    expect(names(tabs.completed).sort()).toEqual([
      'Basavaraj Kadam',
      'Meera Joshi',
      'Vijay Kulkarni',
    ]);
    expect(tabs.all).toHaveLength(6);
  });

  it('Priya: no action; what she submitted is in Completed and in All Workflows', () => {
    const tabs = rowsByTab(seed(), priya);
    expect(tabs['my-actions']).toEqual([]);
    expect(names(tabs.completed).sort()).toEqual([
      'Meera Joshi',
      'Savita Patil',
      'Shobha Gaonkar',
      'Vijay Kulkarni',
    ]);
    expect(names(tabs.all).sort()).toEqual([
      'Meera Joshi',
      'Savita Patil',
      'Shobha Gaonkar',
      'Vijay Kulkarni',
    ]);
    // her draft (Prakash Naik) is not a workflow: it is in My Submissions, not here
    expect(names(tabs.all)).not.toContain('Prakash Naik');
  });

  it('the administrator: nothing to act on or completed, and every workflow', () => {
    const tabs = rowsByTab(seed(), admin);
    expect(tabs['my-actions']).toEqual([]);
    expect(tabs.completed).toEqual([]);
    expect(tabs.all).toHaveLength(6);
    expect(names(tabs.all)).not.toContain('Prakash Naik');
  });
});

describe('the button of a row', () => {
  it("says Review Request where it is the user's turn, in My Actions and in All Workflows", () => {
    const tabs = rowsByTab(seed(), mahesh);
    expect(tabs['my-actions'].every((r) => r.action === 'Review Request')).toBe(true);
    const all = Object.fromEntries(tabs.all.map((r) => [r.applicantName, r.action]));
    expect(all['Manjunath Hiremath']).toBe('Review Request');
    expect(all['Shobha Gaonkar']).toBe('View'); // waiting for Sunita, not for him
    expect(all['Vijay Kulkarni']).toBe('View');
    expect(all['Meera Joshi']).toBe('View'); // approved: nobody's turn
  });

  it('says View in Completed', () => {
    const tabs = rowsByTab(seed(), mahesh);
    expect(tabs.completed.every((r) => r.action === 'View')).toBe(true);
  });

  it('is View for everything for the administrator', () => {
    expect(rowsByTab(seed(), admin).all.every((r) => r.action === 'View')).toBe(true);
  });
});

describe('the KYC Exception flag', () => {
  it('is set for the application with an Exception result, and only that one', () => {
    const flagged = rowsByTab(seed(), admin).all.filter((r) => r.kycException);
    expect(flagged.map((r) => r.applicantName)).toEqual(['Basavaraj Kadam']);
  });

  it('follows the application when the result changes', () => {
    const data = seed();
    data.applications = data.applications.map((a) =>
      a.applicationId === 'HL-2026-0003' ? { ...a, kycOverallResult: 'Exception' as const } : a,
    );
    expect(rowsByTab(data, admin).all.filter((r) => r.kycException)).toHaveLength(2);
  });
});

describe('the words of a row', () => {
  it('writes the tab names with at least two digits', () => {
    expect(tabLabel('My Actions', 7)).toBe('My Actions (07)');
    expect(tabLabel('Completed', 24)).toBe('Completed (24)');
    expect(tabLabel('All Workflows', 0)).toBe('All Workflows (00)');
    expect(tabLabel('All Workflows', 123)).toBe('All Workflows (123)');
  });

  it('writes the title as in the design', () => {
    expect(rowTitle('Ramesh Patil')).toBe('Form Submitted · Home Loan Application · Ramesh Patil');
  });

  it('leaves the name out of the title when there is none', () => {
    expect(rowTitle('')).toBe('Form Submitted · Home Loan Application');
    expect(rowTitle('  ')).toBe('Form Submitted · Home Loan Application');
  });

  it('writes the line below as in the design', () => {
    const instance = seed().workflowInstances[0];
    expect(rowMeta(instance)).toBe(
      'WI-23445213 · Home Loan Approval · Initiated by Priya Kulkarni · 18 Aug 2026, 10:45 AM',
    );
  });

  it('gives the address of the review screen of an instance', () => {
    expect(reviewPath('WI-23445213')).toBe('/workflow/review/WI-23445213');
  });
});

describe('searching', () => {
  const rows = rowsByTab(seed(), admin).all;

  it('matches the applicant, in any case', () => {
    expect(names(filterRows(rows, 'shobha'))).toEqual(['Shobha Gaonkar']);
    expect(names(filterRows(rows, 'PATIL'))).toEqual(['Savita Patil']);
  });

  it('matches the instance ID and the Application ID', () => {
    expect(names(filterRows(rows, 'WI-23445215'))).toEqual(['Manjunath Hiremath']);
    expect(names(filterRows(rows, 'hl-2026-0004'))).toEqual(['Savita Patil']);
    expect(names(filterRows(rows, 'WI-23445218'))).toEqual(['Meera Joshi']);
    expect(names(filterRows(rows, 'hl-2026-0006'))).toEqual(['Meera Joshi']);
  });

  it('does not find the draft: it has no workflow', () => {
    expect(filterRows(rows, 'Prakash')).toEqual([]);
    expect(filterRows(rows, 'hl-2026-0007')).toEqual([]);
  });

  it('matches who submitted it', () => {
    expect(names(filterRows(rows, 'athani'))).toEqual(['Basavaraj Kadam']);
  });

  it('ignores spaces at the ends, and an empty search shows all', () => {
    expect(filterRows(rows, '  vijay ')).toHaveLength(1);
    expect(filterRows(rows, '')).toBe(rows);
    expect(filterRows(rows, '   ')).toBe(rows);
  });

  it('finds nothing for a text that is nowhere, and does not search the PAN or the amount', () => {
    expect(filterRows(rows, 'zzz')).toEqual([]);
    expect(filterRows(rows, 'ABCPK2101L')).toEqual([]);
    expect(filterRows(rows, '2000000')).toEqual([]);
  });
});

describe('ordering', () => {
  const rows = rowsByTab(seed(), admin).all;

  it('puts the newest submission first, or the oldest', () => {
    expect(names(sortRows(rows, true))[0]).toBe('Manjunath Hiremath');
    expect(names(sortRows(rows, true)).at(-1)).toBe('Vijay Kulkarni');
    expect(names(sortRows(rows, false))).toEqual([...names(sortRows(rows, true))].reverse());
  });

  it('does not change the list it is given', () => {
    const copy = [...rows];
    sortRows(rows, false);
    expect(rows).toEqual(copy);
  });
});
