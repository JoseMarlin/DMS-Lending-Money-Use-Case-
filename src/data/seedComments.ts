/**
 * The comments of the seed applications: three or four short loan notes each, written the way the
 * people of the demo would write them (the loan officer on the documents and the applicant, the
 * Branch Manager on a visit or a valuation, the Credit approver on the repayment). They fit the
 * history of each application, so they come between its dates. Dummy people, dummy notes: no
 * Aadhaar number and no real person.
 */
import { roleChipOf } from './recordComments';
import type { RecordComment } from './types';

type Note = [applicationId: string, author: string, at: string, text: string];

const NOTES: Note[] = [
  // HL-2026-0001 Vijay Kulkarni, approved on 26 Aug
  [
    'HL-2026-0001',
    'Priya Kulkarni',
    '2026-08-18T11:20:00+05:30',
    'Documents verified with the applicant at the branch. I have seen the originals of the sale deed and the RTC extract.',
  ],
  [
    'HL-2026-0001',
    'Mahesh Joshi',
    '2026-08-21T10:40:00+05:30',
    'Site visit done. The construction estimate is in order and matches the approved plan.',
  ],
  [
    'HL-2026-0001',
    'Sunita Hegde',
    '2026-08-25T16:05:00+05:30',
    'Salary credits are regular for the last twelve months. Both sureties are known to the branch, so I am going ahead with the sanction.',
  ],
  [
    'HL-2026-0001',
    'Priya Kulkarni',
    '2026-08-27T10:10:00+05:30',
    'Sanction letter handed over to the applicant. The first tranche will be released after the foundation work.',
  ],

  // HL-2026-0002 Shobha Gaonkar, business, waiting at Level 2
  [
    'HL-2026-0002',
    'Priya Kulkarni',
    '2026-09-14T12:15:00+05:30',
    'Runs a retail shop on Khade Bazar road. GST certificate and the last two years of returns are with the file.',
  ],
  [
    'HL-2026-0002',
    'Priya Kulkarni',
    '2026-09-15T15:30:00+05:30',
    'Called both sureties. They confirmed they will sign the guarantee at the branch.',
  ],
  [
    'HL-2026-0002',
    'Mahesh Joshi',
    '2026-09-16T17:00:00+05:30',
    'Visited the shop. Stock and footfall look genuine. The valuation of the plot is in order.',
  ],

  // HL-2026-0003 Manjunath Hiremath, Gokak branch, waiting at Level 1
  [
    'HL-2026-0003',
    'Gokak loan officer (demo)',
    '2026-10-05T11:50:00+05:30',
    'Salaried at a sugar mill in Gokak, salary slips for six months collected. Applicant also gave the employer certificate.',
  ],
  [
    'HL-2026-0003',
    'Gokak loan officer (demo)',
    '2026-10-06T14:20:00+05:30',
    'Both sureties met at the branch. The encumbrance certificate is clear for the last thirteen years.',
  ],
  [
    'HL-2026-0003',
    'Mahesh Joshi',
    '2026-10-08T09:45:00+05:30',
    'Received for review. Will check the valuation report before the decision.',
  ],

  // HL-2026-0004 Savita Patil, returned by Level 1 on 25 Sep
  [
    'HL-2026-0004',
    'Priya Kulkarni',
    '2026-09-22T13:10:00+05:30',
    'Agriculturist, owns 2.5 acres at Hukkeri. The income proof is the ITR acknowledgement of the last year.',
  ],
  [
    'HL-2026-0004',
    'Mahesh Joshi',
    '2026-09-25T10:15:00+05:30',
    'The scan of the income proof is blurred and the amount cannot be read. Asking the loan officer for a clear copy.',
  ],
  [
    'HL-2026-0004',
    'Priya Kulkarni',
    '2026-09-26T16:40:00+05:30',
    'Spoke to the applicant. She brought the original income certificate from the revenue office today; I have scanned it and attached it.',
  ],

  // HL-2026-0005 Basavaraj Kadam, Athani branch, rejected at Level 2 on 9 Sep
  [
    'HL-2026-0005',
    'Athani loan officer (demo)',
    '2026-09-02T12:30:00+05:30',
    'The name on the PAN has the middle initial, the application does not. The documents show it is the same person.',
  ],
  [
    'HL-2026-0005',
    'Mahesh Joshi',
    '2026-09-04T10:05:00+05:30',
    'KYC exception noted. Same person as per the documents, so I am forwarding it to the Credit approver.',
  ],
  [
    'HL-2026-0005',
    'Sunita Hegde',
    '2026-09-08T17:20:00+05:30',
    'The existing obligations are high for the income shown. I will discuss it with the Branch Manager before I decide.',
  ],

  // HL-2026-0006 Meera Joshi, approved on 2 Oct
  [
    'HL-2026-0006',
    'Priya Kulkarni',
    '2026-09-25T12:10:00+05:30',
    'Salaried at the same school for nine years. Salary slips and the letter from the employer are with the file.',
  ],
  [
    'HL-2026-0006',
    'Mahesh Joshi',
    '2026-09-28T11:30:00+05:30',
    'Visited the site with the valuer. The plot is ready for the foundation work.',
  ],
  [
    'HL-2026-0006',
    'Sunita Hegde',
    '2026-10-01T16:40:00+05:30',
    'Repayment is comfortable against the salary. Going ahead with the sanction.',
  ],
  [
    'HL-2026-0006',
    'Priya Kulkarni',
    '2026-10-03T10:30:00+05:30',
    'Sanction letter given to the applicant. The first tranche is planned for the next week.',
  ],

  // HL-2026-0007 Prakash Naik, a draft
  [
    'HL-2026-0007',
    'Priya Kulkarni',
    '2026-10-10T11:20:00+05:30',
    'First meeting at the branch. Wants a plot near Hindalga: the sale agreement is still to come.',
  ],
  [
    'HL-2026-0007',
    'Priya Kulkarni',
    '2026-10-11T15:10:00+05:30',
    'Still waiting for the salary slips and a proper address proof (the electricity bill is attached for now). The applicant said he will bring them on Wednesday.',
  ],
  [
    'HL-2026-0007',
    'Mahesh Joshi',
    '2026-10-11T17:00:00+05:30',
    'The plot has to be in his own name. Please add the sale agreement as soon as it is ready.',
  ],
];

/** The seed comments, oldest first, with their ids. */
export const SEED_COMMENTS: RecordComment[] = NOTES.slice()
  .sort((a, b) => Date.parse(a[2]) - Date.parse(b[2]))
  .map(([applicationId, author, at, text], index) => ({
    id: `CM-${String(index + 1).padStart(5, '0')}`,
    applicationId,
    author,
    authorRole: roleChipOf(author),
    at,
    text,
  }));
