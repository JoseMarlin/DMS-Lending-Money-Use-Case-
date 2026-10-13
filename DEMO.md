# Demo script: Home Loan on DMS+ (Belagavi DCC Bank)

A front-end-only, fully mocked prototype. Everything is dummy data, nothing leaves the browser, and an
Aadhaar number is never shown in full. Scope and rules: `PROJECT_OVERVIEW.md`. How to run it: `README.md`.

## Before you start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in **one** browser window (the state is kept in that browser's localStorage).

- **Act as:** click the avatar at the top right, then pick a name under _Act as_. _Reset demo_ is in the same
  menu: it brings back the seven seed applications and clears everything you did.
- **The people:** Priya Kulkarni (loan officer), Mahesh Joshi (Branch Manager, Level 1 approver), Sunita Hegde
  (Credit approver, Level 2 approver), Admin.
- **The Aadhaar OTP** in the pop-up is always **123456**.
- **Demo controls** (the dashed pill, bottom of the screen) fill the form with a scenario. It is not part of the
  product.
- Any small PDF, JPG, PNG (or DOCX for attachments) up to 5 MB will do when a file is asked for.

Start with **Reset demo**, acting as **Priya**.

## The seven seed applications

| Application  | Applicant          | Kind of applicant | Status     | Made by       | What it is for                                                       |
| ------------ | ------------------ | ----------------- | ---------- | ------------- | -------------------------------------------------------------------- |
| HL-2026-0001 | Vijay Kulkarni     | Salaried          | Approved   | Priya         | The complete journey: 14 files, 29 events, 4 comments, 2 attachments |
| HL-2026-0002 | Shobha Gaonkar     | Business          | In Level 2 | Priya         | Sunita's task; Level 1 is done; has a GSTIN and a GST certificate    |
| HL-2026-0003 | Manjunath Hiremath | Salaried          | In Level 1 | Gokak (demo)  | Mahesh's task                                                        |
| HL-2026-0004 | Savita Patil       | Agriculturist     | Returned   | Priya         | Returned by Mahesh for an unreadable Income Proof: edit and resubmit |
| HL-2026-0005 | Basavaraj Kadam    | Business          | Rejected   | Athani (demo) | A rejection with its reason, and no master record                    |
| HL-2026-0006 | Meera Joshi        | Salaried          | Approved   | Priya         | A second approved record                                             |
| HL-2026-0007 | Prakash Naik       | Salaried          | Draft      | Priya         | A draft that has 3 of 12 documents and no consent: the "errors" demo |

The next application you make is **HL-2026-0008**.

## 1. The 10-minute tour

1. **Master list.** Open _Metadata_, then _Home Loan Application_ (`/metadata/master/home-loan`). As Priya,
   _My Submissions_ shows her five applications. The chips (_InProgress_, _Approved_, _Rejected_, _Action
   Required_) count and filter. _All Records_ is empty until a final approval creates a master record (the seed records are not in it; see section 3).
2. **The record sheet.** Press _View_ on **Vijay Kulkarni**. A sheet slides up over the list: tabs for Application,
   Applicant, Identity, Property, Sureties, KYC, Approval; the search box filters the fields of the tab.
3. **The side panel** (from 1024 px wide). The four icons on the rail are KYC Checks, Comments, Files and
   Attachments, Audit Log. Press the icon that is on to close the panel and give the fields the full width.
4. **Files and Attachments.** Twelve documents, each with its file type, the DocType, a status chip (here
   _Filed_) and the folder as a link (`... / 01 KYC`). The link opens that folder in Files & Folders. The three dots
   give _Preview_ and _Download_ (a placeholder file). Under it, **Other attachments**: two supporting files,
   with a note, who added them and when.
5. **Audit Log.** A timeline, newest first, grouped by day, with chips _All 29, Data changes, Workflow, KYC, Files,
   Comments_ that count. Each entry has an icon, who did it and their role, and the time. Press a chip to filter.
6. **Comments.** The thread of the application, with the comment that came with each approver's decision.
7. **View workflow** goes to the review screen: Record Details, Activity log, Files, Progress.

## 2. Edit scenarios (the record sheet)

Who may edit: the loan officer who owns a _Draft_ or a _Returned_ record, and the administrator; on an _Approved_
record the administrator alone; locked in _Level 1_, _Level 2_ and _Rejected_ (the disabled Edit button says why).

### E1. A draft with errors on two tabs (Prakash Naik, HL-2026-0007), as Priya

1. _View_ on **Prakash Naik** (status _Draft_). Open **Files and Attachments**: 3 of 12 documents, the other nine
   say _Not uploaded, required_ with a _Missing_ chip.
2. Press **Edit**. Every field becomes the form's own input; locked ones have a padlock. The Aadhaar shows
   `XXXX XXXX 1135` with a _Change Aadhaar_ button.
3. Press **Save changes** at once. Nothing is saved: a red banner says _10 fields need attention: Identity (1), Files
   and Attachments (9)_. The Identity tab has a red dot and opens on the consent box (_Tick the consent to continue_),
   and the **Files and Attachments** icon on the rail has a red dot too.
4. Tick the consent. Press **Save changes** again: the banner now counts only the documents, the Files and
   Attachments panel opens by itself and the cursor goes to the **Upload** button of the first missing document.
5. Press **Upload** on each missing row and choose a file. The row shows the file as _v1.0_ and _New file, not saved
   yet_; the counter climbs to 12 of 12. (A file over 5 MB or of another type is refused with the reason.)
6. **Save changes.** The toast says what was saved (for example _Changes saved: 2 fields and 9 documents updated_: the consent and its time, and the nine files).
7. Check: the Audit Log has one **Document uploaded** entry for each file and **Consent given**; the master list
   shows the draft with its new details at once; **Files & Folders**, _Drafts_, _HL-2026-0007 Prakash Naik_ now
   holds all twelve files.

**An identity change runs KYC again.** In edit mode of any record you may edit, change the PAN to `ABCPD9012L` (the
inactive one) and save: a small dialog runs the mocked check (OTP 123456) and says **Fail**, which blocks the save.
A changed name, date of birth, PAN, Aadhaar or GSTIN always runs the check again; any other field does not.

### E2. A returned record: replace a document, save, resubmit (Savita Patil, HL-2026-0004), as Priya

1. _View_ on **Savita Patil** (_Action Required_). The banner says Mahesh returned it: _Income Proof is not
   readable. Upload a clear copy and resubmit._ Files and Attachments shows each file as _Returned_.
2. **Edit**, then in Files and Attachments open the three dots of **Income Proof** and choose **Replace**. Pick a
   file. The row becomes _v1.1_ with _New version v1.1, not saved yet_.
3. Try the three dots of **PAN Card**, then **Remove**: it says **This document is required** and changes nothing.
4. **Save changes.** The toast says _1 document updated_; the Audit Log shows **Document replaced: Income Proof**
   with the old and new file names.
5. A **Resubmit for approval** button now appears in the header. Press it: the application goes back to _In Level
   1_ in the same workflow instance.
6. Act as **Mahesh**, open _Workflow_, _My Actions_: **Savita Patil** is waiting again, with the earlier history.

### E3. The administrator edits an approved record (Vijay Kulkarni, HL-2026-0001), as Admin

1. Act as **Admin**. Open **Vijay Kulkarni**. The **Audit Log** is a good panel to keep open.
2. **Edit**, go to _Applicant_, change _Monthly Income_ to 1,25,000, **Save changes**.
3. A **Reason for change** dialog is required (an empty reason is refused). Type _Income certificate was corrected by
   the applicant_ and save.
4. The Audit Log shows, at the top under _Today_, **Monthly Income changed by the administrator**, the change as
   `₹ 75,000 → ₹ 1,25,000`, the reason, and _Admin_ with the role _Administrator_. The _Data changes_ chip went
   from 2 to 3.
5. As Priya the Edit button on the same record is disabled: _Only the administrator can edit an approved record_.

Also try, as Admin: change the _Estimated Cost_ on _Property_: the Eligible Amount follows as you type and shows
as its own entry in the trail. A sanction that would end above the new Eligible Amount is refused with both amounts.

### E4. Attachments (any record), as Priya

1. Open **Files and Attachments** on **Vijay Kulkarni**. Under _Other attachments_ press **Attach file** and choose
   a PDF, JPG, PNG or DOCX up to 5 MB. A small dialog shows the file and an optional **Note** (200 characters).
2. Press **Attach**. The row shows the name, the note, _Priya Kulkarni_ and the time, with _Filed_. A toast says
   _Attached ..._.
3. Press the folder link of the new row: **Files & Folders** opens `Loans / Home Loan / Belagavi Main Branch (demo)
/ HL-2026-0001 Vijay Kulkarni / 05 Other`, where the attachment sits with the DocType _Supporting Document_.
4. Back in the sheet, the **Audit Log** has **Attachment added** at the top (the _Files_ chip went up by one).
5. Three dots, **Remove** on an attachment you added: a question first (_Remove this attachment?_), then it is gone
   from the panel, from Files & Folders and the count; the trail has **Attachment removed**.
6. Act as **Mahesh** and open the same record (_Workflow_, _Completed_, _View_, then the Application ID in the header, or
   the address `/metadata/master/home-loan?record=HL-2026-0001`): the attachments of Priya have no _Remove_ (only the
   person who attached a file, and the administrator, can remove it). As **Admin** every attachment has it.

### E5. Comments and the trail

1. In **Comments** type a note and press **Send** (Ctrl+Enter also sends). It shows at the bottom of the thread.
2. In the **Audit Log** it is the newest entry, _Comment added_, under _Today_; the _Comments_ chip went up by one.
3. A person can delete only their own comments, after a question.

### E6. Aadhaar stays masked

Type `2345 0007 4821` (any twelve digits) into a comment, an attachment note or a Reason for change, and into
a file name. It is kept as `XXXX XXXX 4821` everywhere: the panel, the Audit Log, the toast, the browser's
localStorage. The Aadhaar field in the form and in edit mode shows only the last four digits.

## 3. The whole journey, from the form

1. Act as **Priya**. In the master press **Create Record**. In the form, open **Demo controls** and choose
   **Scenario A** (Ramesh Patil, Business). Tick the consent, press **Next**, enter OTP `123456`, then the KYC step
   shows _Pass_. **Review**, then **Submit**. Application ID **HL-2026-0008**.
2. The master shows it as _In-Progress_. In **Files & Folders** its files are under _Pending Approval_ (before
   submitting, under _Drafts_).
3. Act as **Mahesh**: _Workflow_, _My Actions_, open the request, **Approve** with a comment. Act as **Sunita**:
   approve with a **Sanctioned Amount** (at most the Eligible Amount) and a date.
4. The record appears in _All Records_ as _Approved_; in Files & Folders the files moved to the branch folder with
   a _Moved_ mark, and **04 Sanction** holds the Sanction Summary. The Audit Log of the record lists the whole story:
   created, each document, consent, KYC, submitted, both decisions, record created, files stored.
5. Other endings: **Return for correction** (the officer edits and resubmits, see E2) or **Reject** (no record; the
   files go to _Rejected_).

## 4. Other things worth showing

- **Scenario B** (Anita Desai): an _Exception_ with name match 86% needs a remark. **Scenario C** (Kiran Naik):
  _Fail_, because the PAN is inactive; Submit is blocked until it is fixed.
- **Loan Purpose** and, for Business and Professional applicants, **GSTIN** are required: the form says _Select Loan
  Purpose_ and _Enter GSTIN_, and the Application section counts _x of 3 required_.
- **Files & Folders**: cards or a table, search by name, DocType, Application ID or applicant, the star on a file,
  a preview, and the folders that follow the real journey.
- **Below 1024 px** the side panel is not drawn (the fields have the whole width).
- **Reset demo** at the end returns to the seven seed applications.
