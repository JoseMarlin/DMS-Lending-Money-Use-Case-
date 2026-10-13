/**
 * Two things for the Files & Folders screen:
 *
 *  - `buildGeneralFileSystem`: the bank's own folders beside the loans (policies, templates, an empty
 *    archive and two files at the top). They belong to no application.
 *  - `buildSampleFileSystem`: a whole sample tree in the structure of PROJECT_OVERVIEW.md section 10
 *    (Loans > Home Loan > {Branch} > {Application ID} {Applicant name} > 01 KYC, 02 Income, 03
 *    Property, 04 Sanction) with files in each status. The screen no longer shows it (the loans are
 *    worked out from the applications, in fileRecords.ts); it is a ready-made tree for the tests of
 *    the screen's parts.
 *
 * The times are counted back from `now`, so a fresh tree always has a folder changed seconds ago
 * and others changed days and months ago.
 */
import { DOC_TYPE_GROUPS } from './options';
import { FileStatus, ROOT_ID, type FileNode, type FileSystem, type FolderNode } from './fileSystem';
import type { DocType, DocTypeGroup, DocumentMimeType } from './types';
import { GROUP_FOLDER, SANCTION_FOLDER } from './filePaths';

export { SANCTION_FOLDER };

const FILE_NAME: Record<DocType, { prefix: string; ext: 'pdf' | 'jpg' }> = {
  'PAN Card': { prefix: 'PAN_Card', ext: 'pdf' },
  'Aadhaar (Masked Copy)': { prefix: 'Aadhaar_Masked_Copy', ext: 'pdf' },
  Photograph: { prefix: 'Passport_Photo', ext: 'jpg' },
  'Address Proof': { prefix: 'Address_Proof_Electricity_Bill', ext: 'pdf' },
  'Income Proof': { prefix: 'Income_Proof', ext: 'pdf' },
  'GST Certificate or Business Licence': { prefix: 'GST_Registration_Certificate', ext: 'pdf' },
  'Surety Documents': { prefix: 'Surety_Documents', ext: 'pdf' },
  'Sale or Gift Deed': { prefix: 'Sale_Deed', ext: 'pdf' },
  'Records of Rights': { prefix: 'RTC_Record_of_Rights', ext: 'pdf' },
  'Encumbrance Certificate': { prefix: 'Encumbrance_Certificate_EC', ext: 'pdf' },
  'Building Permission': { prefix: 'Building_Permission_Order', ext: 'pdf' },
  'Valuation Certificate': { prefix: 'Valuation_Certificate', ext: 'pdf' },
  'Tax Paid Receipt': { prefix: 'Property_Tax_Paid_Receipt', ext: 'pdf' },
};

const MIME: Record<'pdf' | 'jpg', DocumentMimeType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
};

/** Sizes to go round, so that the files do not all weigh the same. */
const SIZES = [184_320, 262_144, 1_126_400, 98_304, 524_288, 733_184, 143_360];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface ApplicationSpec {
  applicationId: string;
  applicant: string;
  uploader: string;
  /** How long ago the files were uploaded, in milliseconds */
  ago: number;
  docTypes: DocType[];
}

const first = (group: DocTypeGroup, count: number): DocType[] =>
  DOC_TYPE_GROUPS[group].slice(0, count);

/** Builds the sample tree. `now` is where the times are counted back from. */
export function buildSampleFileSystem(now: Date = new Date()): FileSystem {
  const folders: FolderNode[] = [];
  const files: FileNode[] = [];
  const at = (ago: number) => new Date(now.getTime() - ago).toISOString();

  const addFolder = (name: string, parentId: string, ago: number): string => {
    const id = `folder-${folders.length + 1}`;
    folders.push({ id, name, parentId, updatedAt: at(ago) });
    return id;
  };

  const addFile = (
    folderId: string,
    name: string,
    mimeType: DocumentMimeType,
    uploadedBy: string,
    ago: number,
    status: FileStatus,
    extra: Partial<FileNode> = {},
  ) => {
    const n = files.length;
    files.push({
      id: `file-${n + 1}`,
      name,
      folderId,
      mimeType,
      sizeBytes: SIZES[n % SIZES.length],
      uploadedBy,
      uploadedAt: at(ago),
      // an occasional second version, as when a file is uploaded again
      version: n % 5 === 4 ? 'v1.1' : 'v1.0',
      status,
      ...extra,
    });
  };

  /** The files of an application, one for each DocType given. */
  const addDocuments = (
    spec: ApplicationSpec,
    status: FileStatus,
    folderFor: (docType: DocType) => string,
  ) => {
    const slug = spec.applicant.replace(/\s+/g, '_');
    spec.docTypes.forEach((docType, i) => {
      const { prefix, ext } = FILE_NAME[docType];
      addFile(
        folderFor(docType),
        `${prefix}_${slug}.${ext}`,
        MIME[ext],
        spec.uploader,
        spec.ago + i * 1000,
        status,
        {
          docType,
          applicationId: spec.applicationId,
          applicantName: spec.applicant,
        },
      );
    });
  };

  const groupOf = (docType: DocType): DocTypeGroup =>
    (Object.keys(DOC_TYPE_GROUPS) as DocTypeGroup[]).find((group) =>
      DOC_TYPE_GROUPS[group].includes(docType),
    ) ?? 'KYC';

  // ---- Loans > Home Loan > {Branch} > {Application ID} {Name} > 01 KYC ... 04 Sanction
  const loans = addFolder('Loans', ROOT_ID, 5 * HOUR);
  const homeLoan = addFolder('Home Loan', loans, 5 * HOUR);

  const filed = (branchId: string, spec: ApplicationSpec, summary: boolean) => {
    const application = addFolder(`${spec.applicationId} ${spec.applicant}`, branchId, spec.ago);
    const groupFolders = new Map<DocTypeGroup, string>();
    (Object.keys(GROUP_FOLDER) as DocTypeGroup[]).forEach((group) =>
      groupFolders.set(group, addFolder(GROUP_FOLDER[group], application, spec.ago)),
    );
    const sanction = addFolder(SANCTION_FOLDER, application, spec.ago);
    addDocuments(spec, FileStatus.Filed, (docType) => groupFolders.get(groupOf(docType))!);
    if (summary) {
      addFile(
        sanction,
        `Sanction_Summary_${spec.applicant.replace(/\s+/g, '_')}.pdf`,
        'application/pdf',
        'System',
        spec.ago - MINUTE,
        FileStatus.Filed,
        {
          docType: 'Sanction Summary',
          applicationId: spec.applicationId,
          applicantName: spec.applicant,
        },
      );
    }
  };

  const belagavi = addFolder('Belagavi Main Branch (demo)', homeLoan, 3 * DAY);
  filed(
    belagavi,
    {
      applicationId: 'HL-2026-0001',
      applicant: 'Vijay Kulkarni',
      uploader: 'Priya Kulkarni',
      ago: 55 * DAY,
      docTypes: [
        ...first('KYC', 4),
        ...first('Income', 2).filter((d) => d !== 'GST Certificate or Business Licence'),
        'Surety Documents',
        ...DOC_TYPE_GROUPS.Property,
      ],
    },
    true,
  );
  filed(
    belagavi,
    {
      applicationId: 'HL-2026-0099',
      applicant: 'Meera Joshi',
      uploader: 'Priya Kulkarni',
      ago: 3 * DAY,
      docTypes: [...first('KYC', 3), 'Income Proof', 'Surety Documents', ...first('Property', 3)],
    },
    false, // the Sanction Summary is optional: this 04 Sanction folder is empty
  );
  const gokak = addFolder('Gokak Branch (demo)', homeLoan, 5 * HOUR);
  filed(
    gokak,
    {
      applicationId: 'HL-2026-0009',
      applicant: 'Prakash Naik',
      uploader: 'Gokak loan officer (demo)',
      ago: 5 * HOUR,
      docTypes: [...first('KYC', 3), 'Income Proof', 'Sale or Gift Deed'],
    },
    false,
  );

  // ---- files that are still in the workflow: one folder for each application, a status for each
  const inWorkflow = addFolder('In Workflow', ROOT_ID, 2 * MINUTE);
  const pending: [ApplicationSpec, FileStatus][] = [
    [
      {
        applicationId: 'HL-2026-0002',
        applicant: 'Shobha Gaonkar',
        uploader: 'Priya Kulkarni',
        ago: 20 * MINUTE,
        docTypes: [...first('KYC', 3), 'Income Proof'],
      },
      FileStatus.PendingApproval,
    ],
    [
      {
        applicationId: 'HL-2026-0004',
        applicant: 'Savita Patil',
        uploader: 'Priya Kulkarni',
        ago: 2 * DAY,
        docTypes: [...first('KYC', 2), 'Sale or Gift Deed'],
      },
      FileStatus.Returned,
    ],
    [
      {
        applicationId: 'HL-2026-0005',
        applicant: 'Basavaraj Kadam',
        uploader: 'Athani loan officer (demo)',
        ago: 40 * DAY,
        docTypes: [...first('KYC', 2), 'Income Proof'],
      },
      FileStatus.Rejected,
    ],
    [
      {
        applicationId: 'HL-2026-0010',
        applicant: 'Anita Desai',
        uploader: 'Priya Kulkarni',
        ago: 2 * MINUTE,
        docTypes: ['PAN Card', 'Aadhaar (Masked Copy)'],
      },
      FileStatus.Draft,
    ],
  ];
  for (const [spec, status] of pending) {
    const folder = addFolder(`${spec.applicationId} ${spec.applicant}`, inWorkflow, spec.ago);
    addDocuments(spec, status, () => folder);
  }

  // ---- plain folders, and one that is empty
  const policies = addFolder('Policies & Circulars', ROOT_ID, 10 * DAY);
  addFile(
    policies,
    'Home_Loan_Policy_2026.pdf',
    'application/pdf',
    'Admin',
    10 * DAY,
    FileStatus.Filed,
  );
  addFile(
    policies,
    'Interest_Rate_Circular_Oct_2026.pdf',
    'application/pdf',
    'Admin',
    12 * DAY,
    FileStatus.Filed,
  );
  addFile(policies, 'KYC_Guidelines.pdf', 'application/pdf', 'Admin', 90 * DAY, FileStatus.Filed);
  const templates = addFolder('Templates', ROOT_ID, 30 * DAY);
  addFile(
    templates,
    'Sanction_Letter_Template.pdf',
    'application/pdf',
    'Admin',
    30 * DAY,
    FileStatus.Filed,
  );
  addFile(templates, 'Branch_Letterhead.png', 'image/png', 'Admin', 45 * DAY, FileStatus.Filed);
  addFolder('Archive 2024', ROOT_ID, 300 * DAY);

  // ---- a couple of files at the top
  addFile(ROOT_ID, 'Branch_Directory.pdf', 'application/pdf', 'Admin', 20 * DAY, FileStatus.Filed);
  addFile(
    ROOT_ID,
    'Document_Naming_Guide.pdf',
    'application/pdf',
    'Admin',
    60 * DAY,
    FileStatus.Filed,
  );

  return { folders, files };
}

/** The sample tree as it is when the app starts. */
export const SAMPLE_FILE_SYSTEM: FileSystem = buildSampleFileSystem();

/**
 * What Files & Folders shows beside the loans: a few plain folders of the bank (policies, templates
 * and an empty archive) and two files at the top. They belong to no application and nothing changes
 * them. The times are counted back from `now`. (The loans themselves are worked out from the
 * applications, in fileRecords.ts.)
 */
export function buildGeneralFileSystem(now: Date = new Date()): FileSystem {
  const folders: FolderNode[] = [];
  const files: FileNode[] = [];
  const at = (ago: number) => new Date(now.getTime() - ago).toISOString();

  const addFolder = (name: string, ago: number): string => {
    const id = `general-folder-${folders.length + 1}`;
    folders.push({ id, name, parentId: ROOT_ID, updatedAt: at(ago) });
    return id;
  };
  const addFile = (
    folderId: string,
    name: string,
    mimeType: DocumentMimeType,
    ago: number,
    sizeBytes: number,
  ) => {
    files.push({
      id: `general-file-${files.length + 1}`,
      name,
      folderId,
      mimeType,
      sizeBytes,
      uploadedBy: 'Admin',
      uploadedAt: at(ago),
      version: 'v1.0',
      status: FileStatus.Filed,
    });
  };

  const policies = addFolder('Policies & Circulars', 10 * DAY);
  addFile(policies, 'Home_Loan_Policy_2026.pdf', 'application/pdf', 10 * DAY, 524_288);
  addFile(policies, 'Interest_Rate_Circular_Oct_2026.pdf', 'application/pdf', 12 * DAY, 184_320);
  addFile(policies, 'KYC_Guidelines.pdf', 'application/pdf', 90 * DAY, 262_144);
  const templates = addFolder('Templates', 30 * DAY);
  addFile(templates, 'Sanction_Letter_Template.pdf', 'application/pdf', 30 * DAY, 98_304);
  addFile(templates, 'Branch_Letterhead.png', 'image/png', 45 * DAY, 733_184);
  addFolder('Archive 2024', 300 * DAY);
  addFile(ROOT_ID, 'Branch_Directory.pdf', 'application/pdf', 20 * DAY, 143_360);
  addFile(ROOT_ID, 'Document_Naming_Guide.pdf', 'application/pdf', 60 * DAY, 1_126_400);

  return { folders, files };
}

/** The plain folders and files of the bank, as they are when the app starts. */
export const GENERAL_FILE_SYSTEM: FileSystem = buildGeneralFileSystem();
