import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SEED_APPLICATIONS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import { DEMO_USERS } from '@/data/users';
import { pendingTasksFor } from '@/data/workflow';
import ApplyPage from './ApplyPage';

const state = () => useAppStore.getState();
/** The applications that are there from the start; a submitted one is one more */
const SEEDED = SEED_APPLICATIONS.length;
const FULL_AADHAAR = /\d{12}|\b\d{4}[ -]\d{4}[ -]\d{4}\b/;

function renderPage() {
  return render(
    <MemoryRouter>
      <ApplyPage />
    </MemoryRouter>,
  );
}

/** Scenario filled, consent ticked, KYC done: sits on Step 2 with the result showing */
async function throughKyc(key: 'A' | 'B' | 'C', remark?: string) {
  const view = renderPage();
  act(() => {
    state().fillScenario(key);
    state().updateDraft({ consentGiven: true });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
  await screen.findByRole('dialog', { name: 'Aadhaar OTP' });
  fireEvent.change(screen.getByLabelText(/^OTP/), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
  await screen.findByText(/^KYC result: /);
  if (remark) {
    fireEvent.change(screen.getByLabelText(/^KYC Exception Remark/), { target: { value: remark } });
  }
  return view;
}

async function toReview(key: 'A' | 'B' | 'C', remark?: string) {
  const view = await throughKyc(key, remark);
  fireEvent.click(screen.getByRole('button', { name: 'Review and submit' }));
  return view;
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('Review and submit', () => {
  it('opens from Step 2 with Back and Submit application in the footer', async () => {
    await toReview('A');
    expect(state().currentStep).toBe(3);
    expect(screen.getByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeEnabled();
    expect(screen.getByRole('list', { name: 'Progress' })).toHaveTextContent('Review');
    expect(screen.getAllByText(state().draft.applicationId).length).toBeGreaterThan(0);
  });

  it('shows what was entered, read only, in the same sections as the form', async () => {
    await toReview('A');
    // each heading also says how many details it holds, for example "Application7 details"
    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => (h.textContent ?? '').replace(/\d+ details$/, ''));
    expect(titles.slice(0, 6)).toEqual([
      'Application',
      'Applicant',
      'Identity',
      'Property and security',
      'Co-applicant',
      'Sureties',
    ]);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('opens the first section, and every section opens and closes', async () => {
    await toReview('A');
    const sections = [
      'Application',
      'Applicant',
      'Identity',
      'Property and security',
      'Co-applicant',
      'Sureties',
    ];
    const toggle = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
    expect(toggle('Application')).toHaveAttribute('aria-expanded', 'true');
    for (const name of sections.slice(1))
      expect(toggle(name)).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle('Applicant'));
    expect(toggle('Applicant')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Ramesh Patil')[0]).toBeVisible();
    fireEvent.click(toggle('Applicant'));
    expect(toggle('Applicant')).toHaveAttribute('aria-expanded', 'false');
  });

  it('Expand all and Collapse all', async () => {
    await toReview('A');
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    for (const b of screen.getAllByRole('button', { expanded: true }))
      expect(b).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { expanded: false })).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
  });

  it('formats the values like the form: Indian grouping, DD/MM/YYYY, Yes or No', async () => {
    await toReview('A');
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    const value = (label: string) => {
      const dt = screen.getAllByText(label, { selector: 'dt' })[0];
      return (dt.nextElementSibling as HTMLElement).textContent;
    };
    expect(value('Loan Amount Requested')).toBe('18,00,000');
    expect(value('Tenure (months)')).toBe('180');
    expect(value('Date of Birth')).toBe('14/03/1984');
    expect(value('Monthly Income')).toBe('1,50,000');
    expect(value('Estimated Cost')).toBe('26,00,000');
    expect(value('Eligible Amount')).toBe('19,50,000');
    expect(value('Add a co-applicant')).toBe('No');
    expect(value('Occupation')).toBe('Business');
    expect(value('GSTIN')).toBe('29ABCPP1234F1Z5');
    expect(value('Surety 1 Name')).toBe('Mohan Joshi');
    expect(value('Application ID')).toBe(state().draft.applicationId);
  });

  it('shows the Aadhaar masked, and never in plain text anywhere on the screen', async () => {
    await toReview('A');
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    const aadhaar = screen.getAllByText('Aadhaar', { selector: 'dt' })[0]
      .nextElementSibling as HTMLElement;
    expect(aadhaar).toHaveTextContent('XXXX XXXX 4821');
    expect(document.body.textContent).not.toMatch(FULL_AADHAAR);
    expect(document.body.innerHTML).not.toContain('234500074821');
  });

  it('hides fields that are not shown on the form: no GSTIN for a salaried applicant', async () => {
    await toReview('B', 'Same person, middle initial missing.');
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.queryByText('GSTIN', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Co-applicant Name', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('shows the KYC result with its badge and the checks', async () => {
    await toReview('A');
    const kyc = screen.getByRole('region', { name: 'KYC result' });
    expect(within(kyc).getByText('Pass')).toBeInTheDocument();
    expect(within(kyc).getAllByText('Verified')).toHaveLength(3); // PAN, Aadhaar and GST
    expect(within(kyc).getByText('XXXX XXXX 4821')).toBeInTheDocument();
    expect(within(kyc).getByText('100%')).toBeInTheDocument();
    expect(within(kyc).getByText('Exact')).toBeInTheDocument();
  });

  it('shows an Exception with its remark', async () => {
    await toReview('B', 'Same person, middle initial missing.');
    const kyc = screen.getByRole('region', { name: 'KYC result' });
    expect(within(kyc).getByText('Exception')).toBeInTheDocument();
    expect(within(kyc).getByText('86%')).toBeInTheDocument();
    expect(within(kyc).getByText('Same person, middle initial missing.')).toBeInTheDocument();
    expect(within(kyc).getByText('Not applicable')).toBeInTheDocument();
  });

  it('lists the uploaded documents with their size', async () => {
    await toReview('A');
    const docs = screen.getByRole('region', { name: /^Documents/ });
    expect(within(docs).getAllByRole('listitem')).toHaveLength(13);
    expect(within(docs).getByText('PAN Card')).toBeInTheDocument();
    expect(within(docs).getByText(/PAN_Card_Ramesh_Patil\.pdf/)).toBeInTheDocument();
    expect(within(docs).getByText('180 KB')).toBeInTheDocument();
    expect(within(docs).getByText('GST Certificate or Business Licence')).toBeInTheDocument();
  });

  it('lists 12 documents for a salaried applicant', async () => {
    await toReview('B', 'ok');
    expect(
      within(screen.getByRole('region', { name: /^Documents/ })).getAllByRole('listitem'),
    ).toHaveLength(12);
  });

  it('lists the documents in the order of the Documents section, not the order they were added', async () => {
    const view = await throughKyc('A');
    // the last document in the form is moved to the front of the record
    act(() => {
      const docs = state().draft.documents;
      state().updateDraft({ documents: [docs[docs.length - 1], ...docs.slice(0, -1)] });
    });
    expect(state().draft.documents[0].docType).not.toBe('PAN Card');
    fireEvent.click(screen.getByRole('button', { name: 'Review and submit' }));
    const items = within(screen.getByRole('region', { name: /^Documents/ })).getAllByRole(
      'listitem',
    );
    expect(items[0]).toHaveTextContent(/^PAN Card/);
    view.unmount();
  });

  it('shows the consent line with the time it was given', async () => {
    await toReview('A');
    const consent = screen.getByRole('region', { name: 'Consent' });
    expect(consent).toHaveTextContent(
      'I authorise the bank to verify my PAN, Aadhaar and GST details with government sources for this loan application.',
    );
    expect(consent).toHaveTextContent(/Consent Time: \d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2} (AM|PM)/);
  });

  it('Back returns to the KYC result without running KYC again', async () => {
    await toReview('A');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(state().currentStep).toBe(2);
    expect(screen.getByText('KYC result: Pass')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cannot be submitted when KYC is not clear: banner, Back to edit, Submit disabled', async () => {
    await toReview('A');
    act(() => state().updateDraft({ kycOverallResult: 'Fail' }));
    expect(screen.getByText('Resolve the KYC result before submitting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeDisabled();
    submit();
    expect(state().draft.status).not.toBe('In Level 1');
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(state().currentStep).toBe(1);
  });

  it('an Exception cannot be submitted once its remark is taken away', async () => {
    await toReview('B', 'ok');
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeEnabled();
    act(() => state().updateDraft({ kycExceptionRemark: '' }));
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeDisabled();
  });
});

describe('Submit application', () => {
  it('sets the status to In Level 1 and saves it in the saved applications', async () => {
    await toReview('A');
    const id = state().draft.applicationId;
    expect(state().applications).toHaveLength(SEEDED);
    submit();
    expect(state().draft.status).toBe('In Level 1');
    const saved = state().applications.find((a) => a.applicationId === id)!;
    expect(saved).toMatchObject({
      status: 'In Level 1',
      fullNameAsPerPan: 'Ramesh Patil',
      pan: 'ABCPP1234F',
      aadhaar: 'XXXX XXXX 4821',
      kycOverallResult: 'Pass',
      consentGiven: true,
    });
    expect(saved.documents).toHaveLength(13);
    expect(state().applications).toHaveLength(SEEDED + 1);
  });

  it('shows the confirmation with the Application ID and the text', async () => {
    await toReview('A');
    const id = state().draft.applicationId;
    submit();
    expect(screen.getByRole('heading', { name: 'Application submitted' })).toBeInTheDocument();
    expect(screen.getByText(id)).toBeInTheDocument();
    expect(screen.getByText('Your application has been sent for approval.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start new application' })).toBeInTheDocument();
    // the form is gone: no stepper, no footer buttons
    expect(screen.queryByRole('list', { name: 'Progress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('keeps no full Aadhaar in the saved application, the store or localStorage', async () => {
    await toReview('A');
    submit();
    expect(JSON.stringify(state())).not.toMatch(FULL_AADHAAR);
    expect(localStorage.getItem('dms-home-loan-demo')).not.toMatch(FULL_AADHAAR);
    expect(document.body.textContent).not.toMatch(FULL_AADHAAR);
  });

  it('submits an Exception with its remark', async () => {
    await toReview('B', 'Same person, middle initial missing.');
    submit();
    const saved = state().applications.at(-1)!;
    expect(saved).toMatchObject({
      status: 'In Level 1',
      kycOverallResult: 'Exception',
      kycExceptionRemark: 'Same person, middle initial missing.',
    });
  });

  it('the confirmation survives a reload', async () => {
    const view = await toReview('A');
    const id = state().draft.applicationId;
    submit();
    view.unmount();
    renderPage();
    expect(screen.getByText(id)).toBeInTheDocument();
    expect(screen.getByText('Your application has been sent for approval.')).toBeInTheDocument();
  });

  it('Start new application opens a blank form with the next Application ID', async () => {
    await toReview('A');
    const first = state().draft.applicationId;
    submit();
    fireEvent.click(screen.getByRole('button', { name: 'Start new application' }));
    expect(state().currentStep).toBe(1);
    expect(state().draft.status).toBe('Draft');
    expect(state().draft.fullNameAsPerPan).toBe('');
    expect(state().draft.applicationId).not.toBe(first);
    // 7 seeded applications, the one just submitted (0008), then this one
    expect(state().draft.applicationId).toMatch(/-0009$/);
    expect(screen.getByLabelText(/^Full Name/)).toHaveValue('');
    expect(screen.getByRole('list', { name: 'Progress' })).toBeInTheDocument();
    // the submitted one is still saved
    expect(state().applications.find((a) => a.applicationId === first)?.status).toBe('In Level 1');
  });

  it('the same PAN cannot be used for a second application: duplicate PAN names the first', async () => {
    await toReview('A');
    const first = state().draft.applicationId;
    submit();
    fireEvent.click(screen.getByRole('button', { name: 'Start new application' }));
    act(() => {
      state().fillScenario('A');
      state().updateDraft({ consentGiven: true });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
    expect(state().currentStep).toBe(1);
    expect(
      screen.getByText(`An application for this PAN already exists: ${first}`, { selector: 'p' }),
    ).toBeInTheDocument();
  });

  it('a second application with another PAN goes through', async () => {
    await toReview('A');
    submit();
    fireEvent.click(screen.getByRole('button', { name: 'Start new application' }));
    act(() => {
      state().fillScenario('B');
      state().updateDraft({ consentGiven: true });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next: KYC Validation' }));
    await waitFor(() => expect(state().currentStep).toBe(2));
  });

  it('Reset demo clears the confirmation and the saved application', async () => {
    await toReview('A');
    submit();
    act(() => state().resetDemo());
    expect(screen.queryByText('Application submitted')).not.toBeInTheDocument();
    expect(state().applications).toHaveLength(SEEDED);
    expect(state().currentStep).toBe(1);
    expect(screen.getByLabelText(/^Full Name/)).toHaveValue('');
  });
});

describe('Submit application starts the workflow', () => {
  it('makes the instance, waiting for the Branch Manager', async () => {
    await toReview('A');
    const id = state().draft.applicationId;
    submit();
    const instance = state().workflowInstances.find((i) => i.applicationId === id)!;
    expect(instance).toMatchObject({
      status: 'In Progress',
      initiatedBy: 'Priya Kulkarni',
      currentNodeIndex: 2,
    });
    expect(instance.nodes.map((n) => n.status)).toEqual(['Done', 'Pending', 'Waiting', 'Waiting']);
    expect(instance.nodes[1].assignee).toBe('Mahesh Joshi');
  });

  it('gives the Branch Manager a task and puts the submission in the trail', async () => {
    await toReview('A');
    const id = state().draft.applicationId;
    submit();
    const tasks = pendingTasksFor(state(), DEMO_USERS.mahesh);
    expect(tasks.map((t) => t.applicationId)).toContain(id);
    const names = state()
      .auditEvents.filter((e) => e.applicationId === id)
      .map((e) => e.event);
    expect(names.slice(-2)).toEqual(['Submitted', 'Workflow started']);
  });

  it('keeps the Aadhaar number out of everything the workflow wrote', async () => {
    await toReview('A');
    submit();
    const text = JSON.stringify([
      state().workflowInstances,
      state().auditEvents,
      state().notifications,
    ]);
    expect(text).not.toMatch(/\d{12}|XXXX XXXX/);
    expect(localStorage.getItem('dms-home-loan-demo')).not.toMatch(/\d{12}/);
  });

  it('works for an Exception with its remark, which both approvers will see', async () => {
    await toReview('B', 'Name differs by a middle initial.');
    const id = state().draft.applicationId;
    submit();
    const saved = state().applications.find((a) => a.applicationId === id)!;
    expect(saved).toMatchObject({
      status: 'In Level 1',
      kycOverallResult: 'Exception',
      kycExceptionRemark: 'Name differs by a middle initial.',
    });
    expect(pendingTasksFor(state(), DEMO_USERS.mahesh).map((t) => t.applicationId)).toContain(id);
  });
});
