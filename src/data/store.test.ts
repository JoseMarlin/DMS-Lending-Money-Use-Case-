import { SCENARIOS, SEED_APPLICATIONS } from './seed';
import { STORAGE_KEY, useAppStore } from './store';

const FULL_AADHAAR = /\d{12}|\b\d{4}[ -]\d{4}[ -]\d{4}\b/;

const state = () => useAppStore.getState();

beforeEach(() => {
  localStorage.clear();
  state().resetDemo();
});

describe('initial state', () => {
  it('starts as Priya on step 1 with a blank draft and 7 saved applications', () => {
    expect(state().currentUserId).toBe('priya');
    expect(state().currentStep).toBe(1);
    expect(state().activeScenario).toBeNull();
    expect(state().applications).toHaveLength(7);
    expect(state().draft.status).toBe('Draft');
    expect(state().draft.fullNameAsPerPan).toBe('');
    expect(state().draft.applicationId).toMatch(/^HL-\d{4}-0008$/);
  });

  it('defaults the branch to the current user branch', () => {
    expect(state().draft.branch).toBe('Belagavi Main Branch (demo)');
    expect(state().draft.createdBy).toBe('Priya Kulkarni');
  });
});

describe('fillScenario', () => {
  it.each([
    ['A', 'Ramesh Patil', 'ABCPP1234F', 'XXXX XXXX 4821'],
    ['B', 'Anita Desai', 'ABCPD5678K', 'XXXX XXXX 7733'],
    ['C', 'Kiran Naik', 'ABCPD9012L', 'XXXX XXXX 2290'],
  ] as const)('fills scenario %s', (key, name, pan, aadhaar) => {
    state().fillScenario(key);
    expect(state().draft).toMatchObject({
      fullNameAsPerPan: name,
      pan,
      aadhaar,
      status: 'Draft',
      consentGiven: false,
    });
    expect(state().activeScenario).toBe(key);
    expect(state().currentStep).toBe(1);
  });

  it('keeps a fresh Application ID and sets the calculated fields', () => {
    state().fillScenario('A');
    expect(state().draft.applicationId).toMatch(/^HL-\d{4}-0008$/);
    expect(state().draft.eligibleAmount).toBe(1_950_000);
    expect(state().draft.coApplicantRequired).toBe('No');
  });

  it('attaches tagged documents uploaded by the current user', () => {
    state().fillScenario('A');
    const docs = state().draft.documents;
    expect(docs).toHaveLength(13);
    expect(docs.every((d) => d.uploadedBy === 'Priya Kulkarni')).toBe(true);
    expect(docs.map((d) => d.docType)).toContain('GST Certificate or Business Licence');
    state().fillScenario('B');
    expect(state().draft.documents).toHaveLength(12);
  });

  it('goes back to step 1 and bumps draftResetCount', () => {
    state().setStep(2);
    const before = state().draftResetCount;
    state().fillScenario('B');
    expect(state().currentStep).toBe(1);
    expect(state().draftResetCount).toBe(before + 1);
  });

  it('does not change the saved applications', () => {
    state().fillScenario('A');
    expect(state().applications).toHaveLength(7);
  });
});

describe('updateDraft', () => {
  it('merges fields and recalculates the eligible amount', () => {
    state().updateDraft({ loanPurpose: 'Construction of house', estimatedCost: 2_600_000 });
    expect(state().draft.eligibleAmount).toBe(1_950_000);
    state().updateDraft({ estimatedCost: 5_000_000 });
    expect(state().draft.eligibleAmount).toBe(3_000_000);
  });

  it('recalculates co-applicant required from the date of birth', () => {
    state().updateDraft({ dateOfBirth: '1950-01-01' });
    expect(state().draft.coApplicantRequired).toBe('Yes');
    state().updateDraft({ dateOfBirth: '1984-03-14' });
    expect(state().draft.coApplicantRequired).toBe('No');
  });

  it('masks a full Aadhaar number before it reaches the store', () => {
    state().updateDraft({ aadhaar: SCENARIOS.A.aadhaarInput });
    expect(state().draft.aadhaar).toBe('XXXX XXXX 4821');
  });
});

describe('Aadhaar never reaches the store or localStorage in full', () => {
  it('after filling every scenario and updating the draft', () => {
    (['A', 'B', 'C'] as const).forEach((key) => {
      state().fillScenario(key);
      state().updateDraft({ aadhaar: SCENARIOS[key].aadhaarInput, mobile: '9876500011' });
      state().saveApplication(state().draft);
    });
    const inMemory = JSON.stringify(state());
    const inStorage = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(inStorage).not.toBe('');
    expect(inMemory).not.toMatch(FULL_AADHAAR);
    expect(inStorage).not.toMatch(FULL_AADHAAR);
    (['A', 'B', 'C'] as const).forEach((key) => {
      expect(inMemory).not.toContain(SCENARIOS[key].aadhaarInput);
      expect(inStorage).not.toContain(SCENARIOS[key].aadhaarInput);
    });
  });

  it('even when something calls setState directly with a full number', () => {
    useAppStore.setState({ draft: { ...state().draft, aadhaar: '234500074821' } });
    useAppStore.setState({
      applications: state().applications.map((a) => ({ ...a, aadhaar: '234500037733' })),
    });
    const inStorage = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(inStorage).not.toMatch(FULL_AADHAAR);
    expect(inStorage).toContain('XXXX XXXX 4821');
  });

  it('even when localStorage was edited by hand', async () => {
    const { draft, applications } = state();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          ...state(),
          draft: { ...draft, aadhaar: '234500074821' },
          applications: applications.map((a) => ({ ...a, aadhaar: '234500037733' })),
        },
        version: 1,
      }),
    );
    await useAppStore.persist.rehydrate();
    expect(state().draft.aadhaar).toBe('XXXX XXXX 4821');
    expect(state().applications.every((a) => a.aadhaar === 'XXXX XXXX 7733')).toBe(true);
  });
});

describe('persistence', () => {
  it('saves to localStorage and restores after a reload', async () => {
    state().fillScenario('A');
    state().setCurrentUser('mahesh');
    state().setStep(2);

    const saved = localStorage.getItem(STORAGE_KEY)!;
    expect(saved).toContain('Ramesh Patil');

    // Simulate a refresh: wipe memory state, then load from localStorage
    useAppStore.setState({ currentUserId: 'priya', currentStep: 1, activeScenario: null });
    localStorage.setItem(STORAGE_KEY, saved);
    await useAppStore.persist.rehydrate();

    expect(state().currentUserId).toBe('mahesh');
    expect(state().currentStep).toBe(2);
    expect(state().activeScenario).toBe('A');
    expect(state().draft.fullNameAsPerPan).toBe('Ramesh Patil');
  });

  it('does not save the action functions', () => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(Object.keys(saved.state).sort()).toEqual(
      [
        'activeScenario',
        'applications',
        'auditEvents',
        'currentStep',
        'currentUserId',
        'draft',
        'draftResetCount',
        'favouriteFileIds',
        'kycOutage',
        'masterRecords',
        'movedFolders',
        'notifications',
        'recordComments',
        'sidebarCollapsed',
        'workflowInstances',
      ].sort(),
    );
  });

  it('falls back to Priya when the saved user is unknown', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { ...state(), currentUserId: 'nobody' }, version: 1 }),
    );
    await useAppStore.persist.rehydrate();
    expect(state().currentUserId).toBe('priya');
  });
});

describe('a saved copy that is old or damaged', () => {
  const load = async (saved: unknown) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, version: 1 }));
    await useAppStore.persist.rehydrate();
  };

  it('is laid over the defaults, so a missing field does not break the draft', async () => {
    const { draft } = state();
    // a save from before these three fields existed
    const old: Record<string, unknown> = { ...draft };
    for (const key of ['consentGiven', 'documents', 'addCoApplicant']) delete old[key];
    await load({ draft: old });
    expect(state().draft.applicationId).toBe(draft.applicationId);
    expect(state().draft.documents).toEqual([]);
    expect(state().draft.consentGiven).toBe(false);
    expect(state().draft.addCoApplicant).toBe(false);
  });

  it('puts back the defaults for values of the wrong kind', async () => {
    await load({
      currentStep: 7,
      kycOutage: 'everything-down',
      activeScenario: 'Z',
      draftResetCount: 'many',
      draft: { applicationId: 'HL-X', documents: 'none' },
      applications: 'not a list',
    });
    expect(state().currentStep).toBe(1);
    expect(state().kycOutage).toBe('none');
    expect(state().activeScenario).toBeNull();
    expect(typeof state().draftResetCount).toBe('number');
    expect(state().draft.documents).toEqual([]);
    expect(state().applications).toHaveLength(7);
  });

  it('drops saved applications that have no Application ID, and keeps the rest', async () => {
    const [first] = state().applications;
    await load({ applications: [first, { fullNameAsPerPan: 'No id' }, null, 'text'] });
    expect(state().applications).toHaveLength(1);
    expect(state().applications[0].applicationId).toBe(first.applicationId);
  });

  it('ignores saved data that is not an object at all', async () => {
    await load('garbage');
    expect(state().applications).toHaveLength(7);
  });
});

describe('the sidebar setting', () => {
  const load = async (saved: unknown) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, version: 1 }));
    await useAppStore.persist.rehydrate();
  };

  beforeEach(() => {
    // Reset demo keeps the sidebar setting, so each test starts from an open sidebar
    useAppStore.setState({ sidebarCollapsed: false });
  });

  it('starts open', () => {
    expect(state().sidebarCollapsed).toBe(false);
  });

  it('toggleSidebar flips the setting and saves it', () => {
    state().toggleSidebar();
    expect(state().sidebarCollapsed).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.sidebarCollapsed).toBe(true);
    state().toggleSidebar();
    expect(state().sidebarCollapsed).toBe(false);
  });

  it('Reset demo keeps how the sidebar is set: it is a screen setting, not demo data', () => {
    useAppStore.setState({ sidebarCollapsed: true });
    state().resetDemo();
    expect(state().sidebarCollapsed).toBe(true);
  });

  it('comes back from a saved copy', async () => {
    await load({ sidebarCollapsed: true });
    expect(state().sidebarCollapsed).toBe(true);
  });

  it('falls back to open when the saved value is of the wrong kind', async () => {
    await load({ sidebarCollapsed: 'yes' });
    expect(state().sidebarCollapsed).toBe(false);
  });
});

describe('the starred files', () => {
  const load = async (saved: unknown) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, version: 1 }));
    await useAppStore.persist.rehydrate();
  };

  it('start with none', () => {
    expect(state().favouriteFileIds).toEqual([]);
  });

  it('toggleFavouriteFile stars a file, takes the star away, and saves', () => {
    state().toggleFavouriteFile('file-3');
    state().toggleFavouriteFile('file-7');
    expect(state().favouriteFileIds).toEqual(['file-3', 'file-7']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.favouriteFileIds).toEqual([
      'file-3',
      'file-7',
    ]);
    state().toggleFavouriteFile('file-3');
    expect(state().favouriteFileIds).toEqual(['file-7']);
  });

  it('come back from a saved copy', async () => {
    await load({ favouriteFileIds: ['file-2', 'file-9'] });
    expect(state().favouriteFileIds).toEqual(['file-2', 'file-9']);
  });

  it('drop what is not an id and keep each id once', async () => {
    await load({ favouriteFileIds: ['file-2', 5, null, 'file-2', { a: 1 }, 'file-4'] });
    expect(state().favouriteFileIds).toEqual(['file-2', 'file-4']);
  });

  it('fall back to none when the saved value is not a list', async () => {
    await load({ favouriteFileIds: 'file-2' });
    expect(state().favouriteFileIds).toEqual([]);
  });

  it('are cleared by Reset demo', () => {
    state().toggleFavouriteFile('file-3');
    state().resetDemo();
    expect(state().favouriteFileIds).toEqual([]);
  });
});

describe('a saved copy with names that only look valid', () => {
  const load = async (saved: unknown) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: saved, version: 1 }));
    await useAppStore.persist.rehydrate();
  };
  const note = {
    id: 'NT-00001',
    userId: 'priya',
    applicationId: 'HL-2026-0001',
    instanceId: 'WI-23445213',
    message: 'Approved.',
    at: '2026-08-10T09:30:00.000Z',
    read: false,
  };

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'does not take "%s" for a user: it falls back to Priya',
    async (name) => {
      await load({ currentUserId: name });
      expect(state().currentUserId).toBe('priya');
    },
  );

  it.each(['constructor', 'toString'])('does not take "%s" for a scenario', async (name) => {
    await load({ activeScenario: name });
    expect(state().activeScenario).toBeNull();
  });

  it('drops a message for "constructor", and a message whose time is not a time', async () => {
    await load({
      notifications: [
        note,
        { ...note, id: 'NT-00002', userId: 'constructor' },
        { ...note, id: 'NT-00003', at: 'yesterday' },
        { ...note, id: 'NT-00004', at: '' },
      ],
    });
    expect(state().notifications.map((n) => n.id)).toEqual(['NT-00001']);
  });

  it('keeps the first of two messages that have the same id', async () => {
    await load({
      notifications: [note, { ...note, message: 'Copy' }, { ...note, id: 'NT-00009' }],
    });
    expect(state().notifications.map((n) => n.id)).toEqual(['NT-00001', 'NT-00009']);
    expect(state().notifications[0].message).toBe('Approved.');
  });
});

describe('when the browser will not save', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps working in memory, with no error, if saving fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => state().setCurrentUser('mahesh')).not.toThrow();
    expect(() => state().toggleSidebar()).not.toThrow();
    expect(() => state().resetDemo()).not.toThrow();
    expect(state().currentUserId).toBe('priya');
  });

  it('starts from the seed data if the saved copy cannot be read at all', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is blocked');
    });
    await expect(useAppStore.persist.rehydrate()).resolves.not.toThrow();
    expect(state().applications).toHaveLength(7);
  });
});

describe('resetDemo', () => {
  it('brings back the seeded state and forgets the filled draft', () => {
    state().fillScenario('A');
    state().setCurrentUser('sunita');
    state().setStep(2);
    state().saveApplication(state().draft);
    expect(state().applications).toHaveLength(8);

    state().resetDemo();

    expect(state().currentUserId).toBe('priya');
    expect(state().currentStep).toBe(1);
    expect(state().activeScenario).toBeNull();
    expect(state().applications).toEqual(SEED_APPLICATIONS);
    expect(state().draft.fullNameAsPerPan).toBe('');
    expect(state().draft.applicationId).toMatch(/-0008$/);
    expect(localStorage.getItem(STORAGE_KEY) ?? '').not.toContain('Ramesh Patil');
  });

  it('bumps draftResetCount so forms reload their input state', () => {
    const before = state().draftResetCount;
    state().resetDemo();
    expect(state().draftResetCount).toBe(before + 1);
  });
});

describe('other actions', () => {
  it('switches the current user', () => {
    state().setCurrentUser('sunita');
    expect(state().currentUserId).toBe('sunita');
  });

  it('a new draft for a head office user falls back to the first branch', () => {
    state().setCurrentUser('sunita');
    state().startNewDraft();
    expect(state().draft.branch).toBe('Belagavi Main Branch (demo)');
    expect(state().draft.createdBy).toBe('Sunita Hegde');
  });

  it('saveApplication adds a new application and replaces one with the same id', () => {
    state().fillScenario('A');
    const draft = state().draft;
    state().saveApplication(draft);
    expect(state().applications).toHaveLength(8);
    state().saveApplication({ ...draft, status: 'Submitted' });
    expect(state().applications).toHaveLength(8);
    expect(state().applications.at(-1)?.status).toBe('Submitted');
    // the next draft gets the next number
    state().startNewDraft();
    expect(state().draft.applicationId).toMatch(/-0009$/);
  });

  it('startNewDraft clears the scenario and goes to step 1', () => {
    state().fillScenario('B');
    state().setStep(2);
    state().startNewDraft();
    expect(state().activeScenario).toBeNull();
    expect(state().currentStep).toBe(1);
    expect(state().draft.fullNameAsPerPan).toBe('');
  });
});
