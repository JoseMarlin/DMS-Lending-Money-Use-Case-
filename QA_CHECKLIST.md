# QA checklist: Home Loan prototype (final)

Two audits made this list. The form (Steps 0 to 2) was run on 2026-10-09 against the Vite dev server in a headless
browser by four auditors (end to end, accessibility, privacy, layout, code), with a second reader checking every defect.
The record sheet, its side panels and the edit mode (Steps 21A to 21E) were checked on 2026-10-13 in the same way: a
scripted browser run on every status, tab and panel, a multi-lens code review (spec, data, privacy, UI, decisions) in
which a second reader tried to refute every finding, and the automated tests. Every defect that was confirmed is fixed
and covered by a test. How to run the demo is in `DEMO.md`.

**Numbers**

|                                                | Count                                                     |
| ---------------------------------------------- | --------------------------------------------------------- |
| Automated tests                                | 2,572 passing (102 files)                                 |
| Type check, ESLint, Prettier, build            | clean                                                     |
| Record sheet: records x tabs x panels x widths | 7 records, 7 tabs, 4 panels, 1366 / 1100 / 1024 px        |
| Defects from the first audit                   | 41 confirmed, all fixed                                   |
| Browser sweep of the record sheet              | 231 checks, no problem, no console message                |
| Code review of Steps 21D and 21E               | 38 findings confirmed (18 distinct), 5 refuted, all fixed |
| Decisions that were waiting for you            | 3, all taken (see Decisions)                              |

## Checklist: the form (Steps 0 to 2)

### Journey

| #   | Check                                                                                                                                   | Result             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Fill with scenario A, B or C fills every section of Step 1; consent is left for the presenter to tick                                   | Pass               |
| 2   | Next with errors shows the exact messages from the overview, lists them in a banner, and each line jumps to its field                   | Pass               |
| 3   | KYC starts by itself on Step 2: PAN, then the Aadhaar OTP pop-up, then GST                                                              | Pass               |
| 4   | Scenario A gives Pass, B gives Exception (a remark is needed), C gives Fail (Review is blocked)                                         | Pass               |
| 5   | Source outage: PAN once (retry, then verified), PAN down (3 retries, then Exception), GST down                                          | Pass               |
| 6   | Changing PAN, Aadhaar, GSTIN, name or date of birth clears the KYC result, including a different Aadhaar with the same last four digits | Pass (fixed)       |
| 7   | Review shows every section, the KYC result, the documents in form order, and the consent                                                | Pass (fixed order) |
| 8   | Submit sets the status to Submitted, shows the Application ID, and saves the application                                                | Pass               |
| 9   | A double click cannot skip a step or submit without showing Review                                                                      | Pass (fixed)       |
| 10  | Reset demo, a scenario fill and Start new application clear the old "saved" message and local state                                     | Pass (fixed)       |
| 11  | A reload keeps the draft; an old or damaged saved copy no longer white-screens the page                                                 | Pass (fixed)       |
| 12  | An unknown address goes to the dashboard (it went to the apply page before the app shell was added)                                     | Pass (fixed)       |
| 13  | A page that breaks shows a message with Reset demo, and the demo panel keeps working                                                    | Pass (new)         |
| 14  | The status stays "KYC Done" when the officer goes Back and Next without changing identity                                               | Pass (fixed)       |

### Privacy (Aadhaar)

| #   | Check                                                                                                                                                                               | Result       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 15  | After entry, on the KYC screen, on Review, on the submitted card and in localStorage the Aadhaar is masked (`XXXX XXXX 1234`); no 12-digit number found in the page text or storage | Pass         |
| 16  | A full number typed into an address, a remark or a file name is masked before it is kept                                                                                            | Pass (fixed) |
| 17  | A number longer than 12 digits is not cut down to a valid-looking one                                                                                                               | Pass (fixed) |
| 18  | Editing inside the Aadhaar number keeps the cursor in place                                                                                                                         | Pass (fixed) |
| 19  | Nothing is written to the console while using the form                                                                                                                              | Pass         |
| 20  | Browser autofill is off for personal fields                                                                                                                                         | Pass (fixed) |

### Accessibility

| #   | Check                                                                                                                         | Result                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 21  | Text colours reach 4.5:1 (grey, red, green and amber text were below it)                                                      | Pass (fixed with new tokens)                                                |
| 22  | Borders of fields and the toggle's off track reach 3:1                                                                        | Pass (decision taken: the token is now `#8091a8`, 3.2:1, instead of 1.45:1) |
| 23  | Focus moves to the step heading when the step changes, and back to the Enter OTP button or heading when the OTP pop-up closes | Pass (fixed)                                                                |
| 24  | Required state is announced for the consent box, the OTP field and each document row                                          | Pass (fixed)                                                                |
| 25  | A progress bar has no value while it fills, then 100                                                                          | Pass (fixed)                                                                |
| 26  | Upload errors are read with the buttons; focus stays put after choosing or removing a file                                    | Pass (fixed)                                                                |
| 27  | An invalid field shows the red focus style                                                                                    | Pass (fixed)                                                                |
| 28  | The OTP pop-up cannot be cancelled while the code is being checked                                                            | Pass (fixed)                                                                |

### Layout

| #   | Check                                                                                                                          | Result       |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 29  | Card is 960 px wide; three fields per row from 1024 px; one column below that; no sideways scroll (checked at 1400 and 768 px) | Pass         |
| 30  | Long names and file names wrap or are cut to two lines (table, KYC cards, document rows, Review)                               | Pass (fixed) |
| 31  | The card scrolls back to the top when the step changes                                                                         | Pass (fixed) |
| 32  | KYC cards keep their height while checking; the OTP pop-up does not jump when an error appears                                 | Pass (fixed) |
| 33  | The error banner leaves room for the form (list is three lines, then scrolls)                                                  | Pass (fixed) |

## Checklist: the record sheet, side panels and edit mode (Steps 21A to 21E)

| #   | Check                                                                                                                                                                                                                                                                                                    | Result                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 34  | View mode: every tab (Application to Approval) and every panel (KYC Checks, Comments, Files and Attachments, Audit Log) of an Approved, In-Progress (Level 1 and Level 2), Returned, Rejected and Draft record draws, with no empty tab, no "undefined" and no sideways scroll at 1366, 1100 and 1024 px | Pass: 231 checks (7 records, 7 tabs, 4 panels, 3 widths), no problem                                                     |
| 35  | Edit a Draft with errors on two tabs (consent on Identity, nine missing documents): the save is refused, both places get a red dot, the banner counts them, the first error is focused, and the Files panel opens on the first missing document                                                          | Pass (fixed: the banner also shows when only documents are missing, and a second blocked Save moves the cursor again)    |
| 36  | An identity change (PAN, Aadhaar, GSTIN, name, date of birth) runs the mocked KYC in a dialog; Fail blocks the save; Exception needs a remark; the master list and the Audit Log show the saved edit at once                                                                                             | Pass (fixed: a changed Aadhaar reads as a change without an old to new line)                                             |
| 37  | The administrator edits an Approved record: a Reason for change is required, the Audit Log says "changed by the administrator", shows old to new and the reason; a sanction above the new Eligible Amount is refused                                                                                     | Pass                                                                                                                     |
| 38  | A Returned record is edited, one of its documents is replaced (v1.0 to v1.1), saved, resubmitted, and the Level 1 inbox of the Branch Manager has it again                                                                                                                                               | Pass (fixed: a document-only correction now offers Resubmit)                                                             |
| 39  | A comment and an attachment added in the sheet show in their panel, in the Audit Log, in Files & Folders (`05 Other`) and in the counts; removing the attachment takes it away everywhere; only its uploader and the administrator can remove it                                                         | Pass (fixed: a draft's trail tells each upload once; the form copy of a draft is no longer overwritten by an attachment) |
| 40  | Aadhaar never in plain text in the page, localStorage or the audit trail after all of the above, and a number typed into a note, comment, reason or file name is masked                                                                                                                                  | Pass (fixed: a number in a file name is masked in the dialog, the toast and the note too)                                |
| 41  | No console error or warning, and no uncaught exception, during any of the runs                                                                                                                                                                                                                           | Pass                                                                                                                     |
| 42  | The panel and the dialogs work from the keyboard: the rail is a toolbar of toggle buttons, menus close with Escape and give the focus back, dialogs keep the focus inside                                                                                                                                | Pass (fixed: the cursor stays in the panel after a row goes)                                                             |

## Decisions taken

These were waiting for you. You asked me to decide, so I did, and I record why.

1. **Field and toggle border contrast.** The border token `--color-field-border` is now `#8091a8` (3.2:1 on white) instead of the Figma value (about 1.45:1), so fields and the toggle's off track pass WCAG 3:1. The look is close to the design but a little darker.
2. **GSTIN for Business and Professional applicants.** Required (_Enter GSTIN_). It is checked in the form, in the KYC step, in the record sheet's edit mode and counted in the "x of y required" summaries. The KYC card for an applicant who is not Business or Professional says GST does not apply.
3. **Loan Purpose.** Required (_Select Loan Purpose_), so the 75% eligibility rule always has its input.
4. **Seed data.** Two applications were added to the five of the overview: HL-2026-0006 (Meera Joshi, Approved) and HL-2026-0007 (Prakash Naik, a Draft with 3 of 12 documents), so the demo has two approved records and a draft to edit. Every seed application has one or two attachments, notes in the Comments panel and a full seeded audit trail. The next application is HL-2026-0008.
5. **Required documents when a record is saved from the sheet.** The edit mode asks for the consent and for every required document, a Draft included, because a record is saved whole. A draft that is incomplete therefore cannot be saved from the sheet until it is complete (the form's own _Save as draft_ is unchanged).
6. **Attachments are saved at once.** They are not part of the edit working copy, so Attach and Remove take effect and are written to the trail immediately, in view and in edit mode. A document of the form that is replaced, uploaded or removed in edit mode waits for _Save changes_.
7. **Who may do what.** The table of roles is an assumption (`src/data/roles.ts`): the loan officer edits a Draft or Returned record that they made, the administrator edits any of those and an Approved record, nobody edits in Level 1, Level 2 or Rejected. An attachment can be removed by the person who attached it and by the administrator.
8. **Edit mode columns.** The inputs follow the width of the form column: three columns while the side panel is open, four when it is closed or the window is wide.
9. **Side panel below 1024 px.** It is not drawn (the fields keep the whole width). Nothing in it is needed to complete an edit except the documents, so below 1024 px a record with a missing document is edited from a wider window.

## Known limits

- Unsaved edits are lost without a question if you open **another record from the bell** while editing (the sheet's own Close, View workflow and folder links do ask first).
- **Below 1024 px** the side panel is not drawn, so a missing document cannot be uploaded there (use a wider window).
- A record with unsaved edits keeps its saved folders in the Files panel until it is saved (the folder of a renamed applicant does not exist yet).

## Not tested here

- The browser's own calendar pop-up and file chooser, and a real screen reader (the test browser cannot show them; a file chosen in the browser run was set by script). A manual pass is needed.
- Production-only console output in browsers other than Edge.
- The "wrong OTP" branch inside the KYC hook: it cannot be reached from the screen, because the pop-up checks the code first.
- A side-by-side check with the Figma frames of the Master and Files & Folders screens: the Figma file that was open in Figma desktop on 2026-10-13 was the Doc Viewer file, not the Master one (see the note below), and the Figma plug-in needs authorising in claude.ai before it can read another file.

## Designed without a Figma reference

Built from the Figma colour, spacing and type tokens, so they look related but are not copies of a design:

- Stepper (the three-step bar)
- Checkbox
- File upload row
- Inline banner (error, warning, info)
- Badge (status chip with spinner)
- Progress bar
- Modal (used for the Aadhaar OTP, the Attach file dialog and the questions)
- Accordion for the sections, with the "Complete" / "x of y required" / "Check details" summary and Expand all / Collapse all
- KYC check cards and the "Entered against as per source" table
- Review screen layout and the submitted card
- The record sheet's side panel and rail, the Files and Attachments panel and the Reason for change dialog
- The "Something went wrong" screen
- Demo controls panel (not part of the product)

The **Audit Log** panel has a partial reference: the Doc Viewer "Audit Log v2" cards in Figma (a square pastel icon badge, a bold title, the time at the right, "by" and old to new lines). The panel follows its structure and type (Noto Sans 14 medium for the title, 12 for the time, `#192839` and `#40566d`) but is a timeline grouped by day, as the step asked.

Colours chosen by me, not taken from Figma: the logo mark, primary hover, disabled fill, scrollbar thumb, the warning and success colours, and the darker text and border tokens added for contrast (subtle grey, error text, field border, toggle off track).

One deliberate change from Figma: the form card is 960 px wide at your request (the Figma frame is 654 px).
