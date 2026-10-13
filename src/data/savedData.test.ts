import { buildSeedWorkflow } from './seedWorkflow';
import { SEED_APPLICATIONS } from './seed';
import { isAuditEvent, isNotification, isWorkflowInstance, uniqueById } from './savedData';

const { workflowInstances, auditEvents } = buildSeedWorkflow(structuredClone(SEED_APPLICATIONS));
const instance = workflowInstances[1];
const event = auditEvents[0];
const note = {
  id: 'NT-00001',
  userId: 'priya',
  applicationId: 'HL-2026-0001',
  instanceId: 'WI-23445213',
  message: 'Approved.',
  at: '2026-10-09T10:00:00.000Z',
  read: false,
};

describe('isWorkflowInstance', () => {
  it('accepts every seed instance', () => {
    for (const i of workflowInstances) expect(isWorkflowInstance(i)).toBe(true);
  });

  it.each([
    ['null', null],
    ['text', 'WI-23445213'],
    ['a list', []],
    ['a wrong id', { ...instance, id: 'X-1' }],
    ['a wrong workflow name', { ...instance, workflowName: 'Something else' }],
    ['a time that is not a time', { ...instance, initiatedAt: 'yesterday' }],
    ['a wrong status', { ...instance, status: 'Finished' }],
    ['a node index out of range', { ...instance, currentNodeIndex: 9 }],
    ['three nodes', { ...instance, nodes: instance.nodes.slice(0, 3) }],
    ['nodes in the wrong order', { ...instance, nodes: [...instance.nodes].reverse() }],
    [
      'a node with a wrong status',
      {
        ...instance,
        nodes: instance.nodes.map((n, i) => (i === 1 ? { ...n, status: 'Maybe' } : n)),
      },
    ],
    [
      'a node with a wrong role',
      { ...instance, nodes: instance.nodes.map((n, i) => (i === 1 ? { ...n, role: 'boss' } : n)) },
    ],
    [
      'a node with no comment text',
      { ...instance, nodes: instance.nodes.map((n, i) => (i === 1 ? { ...n, comment: null } : n)) },
    ],
    ['nodes that are not a list', { ...instance, nodes: 'four' }],
  ])('refuses %s', (_label, value) => {
    expect(isWorkflowInstance(value)).toBe(false);
  });
});

describe('isAuditEvent', () => {
  it('accepts the seed events', () => {
    for (const e of auditEvents) expect(isAuditEvent(e)).toBe(true);
  });

  it.each([
    ['an unknown event', { ...event, event: 'Something happened' }],
    ['a missing user', { ...event, user: undefined }],
    ['a time that is not a time', { ...event, at: 'soon' }],
    ['a number as a comment', { ...event, comment: 5 }],
    ['null', null],
  ])('refuses %s', (_label, value) => {
    expect(isAuditEvent(value)).toBe(false);
  });
});

describe('isNotification', () => {
  it('accepts a good one', () => {
    expect(isNotification(note)).toBe(true);
  });

  it.each([
    ['a user who does not exist', { ...note, userId: 'nobody' }],
    ['an inherited name', { ...note, userId: 'constructor' }],
    ['read as text', { ...note, read: 'no' }],
    ['a time that is not a time', { ...note, at: '' }],
    ['no message', { ...note, message: undefined }],
  ])('refuses %s', (_label, value) => {
    expect(isNotification(value)).toBe(false);
  });
});

describe('uniqueById', () => {
  it('keeps the first of each id, in order', () => {
    expect(
      uniqueById([
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'a', n: 3 },
      ]),
    ).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
  });
});
