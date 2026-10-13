# DMS+ Home Loan prototype (Belagavi DCC Bank)

Front-end-only clickable prototype of the Home Loan master form with KYC on DMS+.
Scope and rules: see `PROJECT_OVERVIEW.md` and `CLAUDE.md`. Everything is mocked. No backend.

## Requirements

Node.js 20 or later, and npm.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Then open http://localhost:5173 (it goes to the dashboard).

Every route is drawn inside the DMS+ app shell (sidebar, top bar, content area) except `/apply` and
`/workflow/review/:instanceId`, which keep their own full-screen layouts.

| Route                                                            | Page                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/dashboard`                                                     | Dashboard (placeholder; says who is acting and what they can do)                                   |
| `/files`                                                         | Files & Folders: folders and files as cards or a table, search, preview (follows the real journey) |
| `/metadata/master/home-loan`                                     | Home Loan Application master: My Submissions and All Records tabs                                  |
| `/metadata/master/home-loan?record=HL-2026-0001`                 | The record bottom sheet over the list (`&section=` is its tab: application ... approval)           |
| `/workflow`                                                      | Workflow: My Actions, Completed and All Workflows lists                                            |
| `/workflow/review/:instanceId`                                   | Review of one workflow request: Record Details, Activity log, Files, Progress panel (no shell)     |
| `/favourite`, `/advance-search`, `/reports`, `/settings`, `/bin` | "Not part of this demo" placeholder                                                                |
| `/apply`                                                         | Home Loan master form: application, KYC, review, submit (no shell)                                 |
| `/demo/components`                                               | Base UI components showcase (placeholder)                                                          |

Any other address goes to `/dashboard`.

## Demo script

The full test script, with the edit scenarios of the record sheet, is in **`DEMO.md`**. The short version:

Open `/apply`. Use the **Demo controls** panel (bottom-left on this form, bottom-right elsewhere; not part of the product) to fill a scenario,
then press **Next** and follow the form. Tick the consent first. The Aadhaar OTP in the pop-up is **123456**.

| Scenario | Applicant              | What it shows                                                                |
| -------- | ---------------------- | ---------------------------------------------------------------------------- |
| A        | Ramesh Patil, Business | Clean pass: all checks verified, name match 100%. Review, submit.            |
| B        | Anita Desai, Salaried  | Exception: name match 86%. A remark is required before Review and submit.    |
| C        | Kiran Naik, Salaried   | Fail: PAN inactive. Submit is blocked. Back to edit, fix the PAN, run again. |

Also try: entering 22,00,000 as the loan amount on scenario A (the 75% rule), the **KYC source outage**
select (a source that is down is retried up to three times, then counts as an Exception), and
**Reset demo** (clears everything, including the saved applications you added).

**The Home Loan master** (`/metadata/master/home-loan`) opens on _My Submissions_: the applications the
current user made (the administrator sees all, an approver none), with status chips that count and filter
(_InProgress_, _Approved_, _Rejected_, _Action Required_; drafts show under _All_), a search box (name or
Application ID), sortable _Name_ and _Created On_, and _Export_ (a CSV of the rows showing, never with PAN or
Aadhaar). _All Records_ shows only the records made at a final Level 2 approval, so it is empty until then.
_Create Record_ (loan officer and administrator only) opens the form; _Submit_ and _Cancel_ in the form come
back to the list, and a submission appears at once as _In-Progress_ with a toast.

**The workflow** (`src/data/workflow.ts`): submitting the form makes an instance of "Home Loan Approval" (the
application becomes _In Level 1_ and the Branch Manager has a task). The Branch Manager approves, returns or
rejects; the Credit approver then approves with a sanctioned amount (at most the Eligible Amount) and a date, or
returns or rejects. A final approval creates the master record and records, for each file, its DocType tag and
folder (nothing is moved). A rejection makes no record. Only the assigned role can act, never the person who
submitted, and the two approvers must differ. Every step is written to the audit trail, with no Aadhaar number.
The seven seed applications (two Approved, one in Level 2, one in Level 1, one Returned, one Rejected and one Draft;
the draft has no instance) have their instances and their whole audit trails, so each approver starts with one task.

**Files & Folders** (`/files`, the sidebar item of the same name): the folders as cards (counts and "Last
updated" worked out from what is inside), the files as cards with a zoom, or one table (list view, the switch
beside the search box). A folder opens in the same page (`?folder=`) with a breadcrumb above the title; the
search looks through the whole tree by name, DocType, application ID and applicant name (several words are fine).
The star on a file is kept. A file opens a mock preview. **The files follow the real journey** (`src/data/filePaths.ts`,
`fileRecords.ts`): every document uploaded in the form is a file here at once (a scenario fill too), a document replaced in
the form keeps one file and goes from v1.0 to v1.1, and a document removed takes its file away. Nothing about a folder is
saved: the place of a file is worked out from the status of its application: _Drafts_ (the folder is "Draft {Application
ID}" until a name is entered), _Pending Approval_ (Submitted, In Level 1, In Level 2, Returned), _Rejected_, and the
folder of the branch once Approved, each as Loans / Home Loan / {place} / {Application ID} {Name} / 01 KYC, 02 Income,
03 Property (04 Sanction holds the Sanction Summary that a final approval adds). A file's status follows too: Draft,
Pending approval, Returned, Rejected, Filed. A folder that files were moved into (a submission, the final approval, a
rejection, a change of the branch of an approved record) carries a "Moved" mark, with the folders above it, until it is
opened; the final approval and a rejection also say where the files went in a toast with "Open folder". The Files tab of
the review screen shows the same place as a link into this screen, with the status. The policies, templates and the
archive are the bank's own folders (`sampleFiles.ts`), not tied to an application. _Magic Folder_ in the sidebar is dimmed and opens "Not part of this demo".

**The record sheet**: _View_ on a row of the master (both tabs), _View record_ in the file preview, the
Application ID in the header of the review screen and the links in the bell open
`/metadata/master/home-loan?record=HL-2026-0001`, a sheet that slides up over the list and the sidebar (Esc or the
cross closes it). Tabs: Application, Applicant, Identity, Property, Sureties, KYC, Approval (the fields are the form's
own), with a banner for a draft, an application in approval, a returned one and a rejected one, and a search box that
filters the fields of the tab. _View workflow_ opens the review screen for the people on that workflow and the
administrator.

**The side panel of the sheet** (at the right of the tabs, from 1024px wide; below that it is not drawn): a 360px
panel and a 40px rail of icons, KYC Checks (the checklist) at the top, then Comments, Files and Attachments and Audit
Log. The title of the panel is in the row of the tabs. The icon that is on is light lavender; pressing it closes the
panel, so the fields have the whole width, and any icon opens it again. It opens on KYC Checks for a Draft or an
In-Progress record and on Comments for the others. _KYC Checks_ lists PAN format, PAN active, Aadhaar valid, Aadhaar
authentication, GST active (only with a GSTIN), Name match percent, Date of birth match and PAN and Aadhaar link, each
with a chip (Passed, Exception, Failed, Unavailable, or Not checked for a draft that has not been through KYC) and a
chevron that opens what was entered and what the source says; everything comes from the stored result, and the Aadhaar is
the masked one. _Comments_ is the thread of the application, oldest first: its notes (three or four for each seed
application) and, taken from the audit trail, the comment of each Level 1 and Level 2 decision, with a chip "Level 1
decision" or "Level 2 decision". The box at the bottom adds a comment as the user who is acting (Ctrl+Enter sends),
writes the audit event "Comment added" and masks an Aadhaar number that was typed; a person can delete only their own
comments, after a question.

_Files and Attachments_ has two groups. **Application documents** lists the documents the form asks for (12, 13 for a
Business or Professional applicant): the file type icon, the file name, the DocType muted, a version, a status chip (Draft,
Pending approval, Returned, Rejected or Filed, from the status of the application) and the folder as a link into `/files`
(`... / 01 KYC`), with a three-dot menu for _Preview_ and _Download_ (a placeholder). A document that is missing says
"Not uploaded, required". **Other attachments** are supporting files (`src/data/attachments.ts`): _Attach file_ takes a
PDF, JPG, PNG or DOCX up to 5 MB, then a small dialog with an optional note (200 characters); a row shows the name, the
note, who added it and when, with _Preview_ and _Remove_ (only the person who attached it and the administrator, after a
question). An attachment is a document of DocType "Supporting Document" kept in the sub-folder **05 Other** of the
application, so Files & Folders, the counts and the Files tab of the review screen show it at once, and attaching or
removing one writes the audit events "Attachment added" and "Attachment removed". An Aadhaar number typed into a note
or a file name is masked.

_Audit Log_ is a timeline of what happened to the application, newest first and grouped by day (Today, Yesterday, then
the date), with an icon for the kind of event, the text, who did it with their role, and the time. A change of a value
reads "old → new"; an edit of an approved record by the administrator says so and shows its reason. Chips (All, Data
changes, Workflow, KYC, Files, Comments) filter it and count live; an application with no events says "No activity
yet". Every seed application has a full history (created, each document, consent, KYC, submission, decisions, record
created, files stored, comments, attachments); a draft's history is told from what it holds. A new comment, file or
decision is in it at once.

**Editing a record** (_Edit_ in the header of the sheet): allowed for the loan officer who owns a Draft or a
Returned record and for the administrator, for the administrator alone on an Approved one, and locked in
Level 1, Level 2 and Rejected (the button says why). Every field of every tab becomes the form's own input, in a
working copy kept while you switch tabs (the Application ID and Date, the Eligible Amount, the Consent Time and the
KYC and Approval tabs are locked, with a padlock; the Eligible Amount follows as you type). The Aadhaar is shown
masked with a _Change Aadhaar_ button. _Save changes_ checks every tab (tabs with errors get a red dot, the banner
says how many, the first error is opened and focused); an edit of PAN, Aadhaar, GSTIN, name or date of birth runs
the mocked KYC again in a small dialog (OTP 123456; a Fail blocks the save, an Exception needs a remark); an
approved record asks for a _Reason for change_. Each changed field is one audit event (an Aadhaar is written as
"changed"), and the master list shows the edit at once. After a Returned record is saved, _Resubmit for approval_
sends it back to Level 1 in the same workflow instance. _Cancel_ with changes asks first, and so does _View workflow_
while there are unsaved changes. A save with nothing changed only says so (no reason is asked), a record that has no
Aadhaar, or one that was kept as not valid, opens its Aadhaar as an input that says what is wrong, and the sanction of
an approved record cannot be left above the new Eligible Amount (the save is refused with both amounts). In edit mode the
inputs follow the width of the form column: 3 columns while the side panel is open, 4 when it is closed or the window is wide.
**The documents are edited in the Files and Attachments panel** while the sheet is in edit mode: _Replace_ on a document
gives its next version (v1.0 to v1.1), _Upload_ fills a document that is missing (v1.0), and _Remove_ is refused for a
document the form requires ("This document is required"). These changes are held in the working copy ("New version v1.1, not
saved yet") and saved with _Save changes_, which also asks for every required document and for the consent: a record that
is not complete, a draft included, is not saved, the tab and the rail icon get a red dot and the cursor goes to the first
missing document. Each uploaded, replaced or removed document is an audit event, and the master record, Files & Folders and
the review Files tab follow. Attachments are not part of the working copy: they are added and removed at once.

**Switching user:** click the avatar at the top right of the shell, then pick a name under _Act as_
(Priya, Mahesh, Sunita or Admin). The avatar, the dashboard and the bell change at once. _Reset demo_ is
also in that menu. The bell shows a red count of the approval tasks and unread messages waiting for the user.

## Where things are

```
design/                      Reference images (DMS+ look); core/ holds shared references
src/
  theme/theme.css            Colours, fonts, radii, shadow: from the Figma form file
  components/ui/             Base UI components, usePopover (open/close logic of the dropdowns) and useFocusTrap
                             (the keyboard of a dialog: the Modal and the record sheet); FileTypeIcon + fileKind.ts
                             (the icon of a PDF, image or Word file)
  components/shell/          App shell: Sidebar, TopBar, UserMenu, NotificationsMenu, ShellLayout, icons
  features/master/           Home Loan master list: list page, panels, row actions, listData.ts (the rules)
  features/master/record/    The record bottom sheet (RecordSheet; recordSheetModel.ts holds the rules: the tabs,
                             the fields of each tab from the form schema, the banner, who may open the workflow).
                             Edit mode: editModel.ts (the inputs of each tab, the form's validation by tab, what
                             changed), useRecordEdit.ts (the working copy and the steps of a save), EditFields,
                             KycRerunDialog and ReasonDialog
  features/master/record/panel/  The side panel and its rail: RecordSidePanel (rail, collapse, which panel opens
                             first: sidePanelModel.ts), KycChecksPanel + kycChecksModel.ts (the rows, worked out
                             from the stored result), CommentsPanel, FilesPanel + filesPanelModel.ts (the document
                             and attachment rows, status, folder link, preview, download), AuditPanel +
                             auditLogModel.ts (the events as a timeline: icons, old to new, filters, day groups)
  features/workflow/         /workflow list: page, and workflowList.ts (what each tab holds, search, order)
  features/workflow/review/  /workflow/review/:instanceId, full screen outside the shell: ReviewPage and its
                             panels; reviewModel.ts holds the rules (who can act, the Progress steps, the rows);
                             FilesTab + filesModel.ts (where each file is now, sorting); ActivityLog +
                             activityModel.ts (the audit events of the application, newest first)
                             TakeActionDialog + takeActionModel.ts (Approve, Reject, Return for correction;
                             the sanction fields at Level 2; the validation rules)
  features/files/            /files (Files & Folders): FilesPage, FolderCard, FileCard, FilesListView, the
                             sections, zoom, view switch, breadcrumb; filesPageModel.ts holds the rules (folder in
                             the address, trail, search, list rows); FilePreviewModal (mock preview of a file),
                             FileStatusBadge (the status chip of a file) and FileRowMenu (the three-dot menu)
  components/demo/           DemoPanel (presenter controls, not part of the product UI)
  features/home-loan/
    form/                    Step 1: schema (step1Schema.ts) and the renderer
    validation/              Rules from section 7 (rules.ts) and the validator
    kyc/                     Step 2: runner, result rules (evaluate.ts), check rows, OTP pop-up
    review/                  Step 3: review summary and the confirmation card
  data/                      Single shared data model
    types.ts                 HomeLoanApplication and the enums
    options.ts               Dropdown options, DocTypes, bank limits, KYC thresholds
    aadhaar.ts               maskAadhaar(), Verhoeff check
    application.ts           Blank application, calculated fields, Application ID, KYC reset
    seed.ts                  Demo users, scenarios A/B/C, 7 existing applications (with their attachments)
    store.ts                 Zustand store, saved to localStorage, resetDemo(); the workflow actions
    users.ts                 The four demo users (section 5)
    workflow.ts              The workflow "Home Loan Approval" as plain functions: submit, approve, reject,
                             return, resubmit, who may act, filing data, audit events, and the lookups (pending tasks ...)
    recordEdit.ts            Who may edit a record, and saving an edit: the record, an audit event per field and
                             per document (uploaded, replaced, removed)
    attachments.ts           The supporting files of an application: the rules (type, size, who removes), add, remove
    seedWorkflow.ts          The seed applications' instances and audit trails
    recordComments.ts        The comments of the side panel: the thread (notes and decisions), add, delete one's own
    seedComments.ts          The seed applications' notes
    fileSystem.ts            Generic folders and files for /files: counts, trail, search, the file statuses
    filePaths.ts             Where a file is, from the status of its application (folder names, subfolder of a DocType)
    fileRecords.ts           The file records worked out from the applications, the tree, the moves, the toast sentences
    sampleFiles.ts           The bank's own folders on /files (policies, templates); also a sample tree used by tests
    savedData.ts             Checks on workflow data read back from localStorage
    roles.ts                 What each demo role can do (an assumption, see the file)
  services/mockKyc.ts        Mock PAN, Aadhaar and GST sources, with the delays
  lib/format.ts              Indian number grouping, DD/MM/YYYY, list dates, file sizes
  lib/csv.ts                 CSV writing and download (cells that look like formulas are made safe)
  pages/                     ApplyPage, DashboardPage, NotInDemoPage, PlaceholderPage, ComponentsPage
```

**KYC delays** are constants in `src/services/mockKyc.ts` (`DEFAULT_KYC_CONFIG`): PAN 1.5 s, Aadhaar
2 s after the OTP, GST 1.5 s, three retries for an unavailable source. In tests they are set to 1 ms.

## Other commands

| Command                | What it does                    |
| ---------------------- | ------------------------------- |
| `npm run build`        | Type-check and build to `dist/` |
| `npm run preview`      | Serve the production build      |
| `npm run lint`         | ESLint                          |
| `npm run format`       | Prettier (write)                |
| `npm run format:check` | Prettier (check only)           |
| `npm test`             | Vitest, single run              |
| `npm run test:watch`   | Vitest, watch mode              |

## Demo notes

- `DEMO.md` is the script to follow; `QA_CHECKLIST.md` is the record of the checks, the decisions taken and what could not be tested here.
- Use a single browser window. State is saved to localStorage per browser, with no sync between tabs.
- Aadhaar is always masked: the full number exists only in the Aadhaar input while it has focus.
- The "Demo controls" panel (bottom-left on the form, bottom-right in the app shell) is for the presenter and is not part of the product UI.
