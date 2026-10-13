# Project overview: Home Loan with KYC, clickable prototype on DMS+

Owner: Jitesh Anbalagan, Product Manager, DmacQ Solutions.
Status: working prototype for a customer demo. Read this file fully before writing any code.

## 1. What we are building

A clickable, front-end-only prototype of one end-to-end journey in **DMS+** (DmacQ's document management platform), for the customer **Belagavi District Central Co-operative Bank Ltd** (a district co-operative bank with about 100 branches). The demo product is the bank's **Home Loan**.

The journey: a loan officer fills a home loan application with documents and consent, KYC is verified automatically (PAN, Aadhaar, GST), the application goes through a **two-level approval workflow**, and only after final approval is the record created in the master and the files stored in folders.

The point of the demo: the bank today uses several separate tools for this. We show that DMS+ does it on one platform using **Masters with forms, DocTypes, Folders and Workflow**.

This is a prototype. There is no backend and no real API call. Everything is mocked and runs in the browser.

## 2. How to work (rules)

1. **One screen or step at a time.** I will tell you which one. Do not build ahead.
2. **One shared data model** in `src/data`. Every screen reads and writes through it, so screens stitch together later without rework.
3. **No backend, no auth, no real APIs.** KYC checks are mocked with fixed delays (section 8). State lives in memory and is saved to localStorage so a refresh does not lose the demo. A **Reset demo** button clears it.
4. **Dummy data only.** Never use a real PAN, Aadhaar or GSTIN.
5. **Aadhaar is always masked**, everywhere: after entry in the form, in the record view, lists, audit trail and exports. Show only the last four digits (XXXX XXXX 4821). Never log the full number.
6. **Match the DMS+ look.** Reference screens are in `/design`. Reuse their colours, fonts, spacing, components and navigation. If a reference is missing for a screen, ask me instead of inventing a new style.
7. **Use the exact field names, statuses and DocType names** in this file. This prototype doubles as the build spec.
8. Include a **scenario switcher** (A, B, C) and the **Reset demo** button from the start.
9. **Desktop first**, laptop width. Mobile is out of scope.
10. Keep the code simple and readable. It will be demoed live and may be handed to engineers.

Default stack, unless the repo already has one: React, TypeScript, Vite, Tailwind, React Router, Zustand.

## 3. Product context: DMS+ concepts

| Concept         | Meaning in DMS+                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Master**      | A structured record type (like a table). Fields have types: text, number, email, phone, multi line, dropdown, date, attachment |
| **Master form** | A form used to capture a master record. Here it has two steps: Step 1 application, Step 2 KYC validation                       |
| **DocType**     | A document classification. A DocType is tied 1:1 to a file. A file is tagged with a DocType and linked to a master record      |
| **Folder**      | Where files are stored. Connector settings link folders to masters and DocTypes                                                |
| **Workflow**    | A configurable flow. Nodes used here: Trigger, Approval, If/else, Update Metadata, Email, Pause, End                           |

## 4. The journey, end to end

1. **Step 1, Master form:** the loan officer enters application data, uploads documents, and gives consent.
2. **Step 2, Master form:** KYC validation runs automatically (PAN, Aadhaar, GST) and shows a Pass, Exception or Fail result.
3. **Submit.** Fail blocks submit. Pass allows it. Exception allows it only with a remark from the loan officer.
4. **Workflow "Home Loan Approval" starts.** Until final approval the data and files live inside the workflow. No master record exists yet.
5. **Level 1: Branch Manager** reviews the application, KYC result and documents. Approve, Return or Reject.
6. **Level 2: Credit approver** (head office) enters the sanctioned amount, sanction date and remarks. Approve, Return or Reject.
7. **On final approval:** the master record is created with status Approved, DocType tags are applied, files are stored in the folder structure, and the loan officer is notified.
8. **On rejection:** status Rejected, the loan officer is notified with the reason, **no master record is created, and the files stay in the workflow**.
9. **On return:** the application goes back to the loan officer, who corrects and resubmits. If identity fields (PAN, Aadhaar, GSTIN, name, date of birth) changed, KYC re-runs.

Approvers must be different people from the loan officer and from each other.

## 5. Demo users (dummy)

| Role                              | Name           | Branch or office            |
| --------------------------------- | -------------- | --------------------------- |
| Loan officer (maker)              | Priya Kulkarni | Belagavi Main Branch (demo) |
| Level 1 approver, Branch Manager  | Mahesh Joshi   | Belagavi Main Branch (demo) |
| Level 2 approver, Credit approver | Sunita Hegde   | Head Office, Credit (demo)  |
| Administrator                     | Admin          | Head Office                 |

Provide a simple "act as" switcher in the header so the demo can move between users.

## 6. Data model: master "Home Loan Application"

Use camelCase keys derived from the labels. Types: text, number, email, phone, multiLine, dropdown, date, checkbox, attachment, auto, calculated.

### 6.1 Application

| Label                 | Type     | Notes                                                                                                  |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| Application ID        | auto     | Format HL-2026-0001                                                                                    |
| Branch                | dropdown | Defaults to the user's branch                                                                          |
| Loan Product          | dropdown | Home Loan                                                                                              |
| Loan Purpose          | dropdown | Construction of house, Purchase of flat, Purchase of plot, Takeover of housing loan, Property mortgage |
| Loan Amount Requested | number   | Maximum 30,00,000                                                                                      |
| Tenure (months)       | number   | Maximum 240                                                                                            |
| Application Date      | auto     | Today                                                                                                  |

### 6.2 Applicant

| Label                  | Type      | Notes                                           |
| ---------------------- | --------- | ----------------------------------------------- |
| Full Name (as per PAN) | text      |                                                 |
| Date of Birth          | date      | Age 18 to 55 at application                     |
| Mobile                 | phone     | 10 digits                                       |
| Email                  | email     |                                                 |
| Occupation             | dropdown  | Salaried, Business, Professional, Agriculturist |
| Monthly Income         | number    |                                                 |
| Address                | multiLine |                                                 |
| PIN Code               | text      | 6 digits                                        |

### 6.3 Identity

| Label   | Type | Notes                                                  |
| ------- | ---- | ------------------------------------------------------ |
| PAN     | text | Always required                                        |
| Aadhaar | text | Masked after entry, stored hidden                      |
| GSTIN   | text | Shown only when Occupation is Business or Professional |

### 6.4 Property and security

| Label               | Type       | Notes                                                             |
| ------------------- | ---------- | ----------------------------------------------------------------- |
| Property Address    | multiLine  |                                                                   |
| Property Owner Name | text       | Must match the applicant                                          |
| Estimated Cost      | number     |                                                                   |
| Eligible Amount     | calculated | Construction of house: 75% of Estimated Cost, capped at 30,00,000 |
| Security Type       | dropdown   | Mortgage of unencumbered immovable property                       |

### 6.5 Co-applicant and sureties

| Label                       | Type              | Notes                                                           |
| --------------------------- | ----------------- | --------------------------------------------------------------- |
| Co-applicant Required       | calculated        | Yes if applicant age is above 60 (rule unclear, see section 16) |
| Co-applicant Name, Relation | text, dropdown    | Relation: Spouse, Son, Father, Mother                           |
| Surety 1 Name, Mobile, PAN  | text, phone, text | Two sureties required                                           |
| Surety 2 Name, Mobile, PAN  | text, phone, text |                                                                 |

Only the applicant gets KYC verification in the demo. Co-applicant and sureties are captured as data only.

### 6.6 Consent

| Label         | Type     | Notes                   |
| ------------- | -------- | ----------------------- |
| Consent Given | checkbox | Mandatory before Step 2 |
| Consent Time  | auto     | System timestamp        |

Consent text: "I authorise the bank to verify my PAN, Aadhaar and GST details with government sources for this loan application."

### 6.7 KYC validation (Step 2, system-written, read-only)

| Label                                    | Type                                |
| ---------------------------------------- | ----------------------------------- |
| PAN Status, PAN Name as per Source       | dropdown, text                      |
| Aadhaar Status, Aadhaar Reference        | dropdown, text                      |
| GST Status, GST Legal Name, GSTIN Status | dropdown, text, dropdown            |
| Name Match Percent                       | number                              |
| Date of Birth Match                      | dropdown (Exact, Mismatch)          |
| KYC Overall Result                       | dropdown (Pass, Exception, Fail)    |
| KYC Exception Remark                     | multiLine (required when Exception) |
| KYC Checked On                           | date                                |
| Retry Count                              | number                              |

Check status values: Pending, Checking, Verified, Failed, Unavailable, Not applicable, OTP required.

### 6.8 Approval fields (filled in the workflow)

| Label                                                             | Type                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Level 1 Approver, Level 1 Decision, Level 1 Remarks, Level 1 Time | text, dropdown, multiLine, date                                      |
| Level 2 Approver, Level 2 Decision, Level 2 Remarks, Level 2 Time | text, dropdown, multiLine, date                                      |
| Sanctioned Amount                                                 | number (default the requested amount, cannot exceed Eligible Amount) |
| Sanction Date                                                     | date (default today)                                                 |

### 6.9 Status values

Draft, KYC Done, Submitted, In Level 1, In Level 2, Returned, Approved, Rejected.

## 7. Validation rules

Rules marked (bank) come from the bank's public Home Loan page and need the bank's confirmation.

| When               | Rule                                                                                   | Message                                                      |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| On leaving a field | PAN format: 5 letters, 4 digits, 1 letter; 4th letter P for individuals                | Enter a valid PAN, for example ABCPP1234F                    |
| On leaving a field | GSTIN is 15 characters, valid state code, contains the PAN                             | GSTIN does not match the PAN entered                         |
| On leaving a field | Aadhaar is 12 digits and passes the Verhoeff checksum                                  | Enter a valid 12-digit Aadhaar                               |
| On leaving a field | Mobile is 10 digits, PIN is 6 digits                                                   | Enter a valid mobile number                                  |
| On leaving a field | Age 18 to 55 (bank)                                                                    | Applicant age must be between 18 and 55                      |
| On leaving a field | Loan Amount Requested at most Eligible Amount (bank: 75% of estimate for construction) | Amount exceeds 75% of the estimate. Maximum {eligible}       |
| On leaving a field | Loan Amount Requested at most 30,00,000 (bank)                                         | Maximum home loan is 30,00,000                               |
| On leaving a field | Tenure at most 240 months (bank)                                                       | Maximum tenure is 240 months                                 |
| On leaving a field | Property Owner Name matches applicant (bank)                                           | Property must be in the applicant's name                     |
| On upload          | PDF, JPG or PNG, up to 5 MB each                                                       | Upload PDF, JPG or PNG up to 5 MB                            |
| Moving to Step 2   | Required fields, required documents, two sureties, consent ticked                      | Errors summarised at the top, first error in view            |
| Moving to Step 2   | No existing application with the same PAN                                              | An application for this PAN already exists: {Application ID} |
| Submit             | KYC Overall Result is not Fail; if Exception, the remark is filled                     | Resolve the KYC result before submitting                     |

## 8. Step 2: KYC validation behaviour (mocked)

KYC starts **automatically** when the user moves to Step 2. There is no Verify button. An analyst-style "Re-run" link is allowed.

Each check shows its own state with a progress bar: PAN, Aadhaar (with an OTP pop-up, mock OTP 123456), GST (skipped as Not applicable when Occupation is not Business or Professional). Mock delays: PAN 1.5 s, Aadhaar 2 s after OTP, GST 1.5 s. Make delays a config constant.

After the checks, show a side-by-side table (entered against as per source) with a match indicator, then the overall result.

| Result    | Condition                                                                                 | Behaviour                                                                                    |
| --------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Pass      | All checks Verified, name match at least 95%, date of birth exact                         | Submit enabled                                                                               |
| Exception | Name match 70 to 94%, or a source Unavailable after three retries                         | Submit enabled once the loan officer enters a remark. A badge shows on both approval screens |
| Fail      | PAN not found or inactive, GST cancelled, date of birth mismatch, or name match below 70% | **Submit blocked.** The officer corrects the data and re-runs                                |

Precedence: any Fail condition makes the result Fail; otherwise any Exception condition makes it Exception; otherwise Pass.

An **Unavailable** source (timeout) is different from Failed. It retries up to three times, then counts as Exception. Never reject on Unavailable alone.

## 9. Workflow: "Home Loan Approval"

| #   | Node                                | Behaviour                                                                                                                             |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Trigger                             | Form submitted. Status set to In Level 1                                                                                              |
| 2   | Approval, Level 1 (Branch Manager)  | Tabs: Application, KYC Result, Documents. Actions: Approve, Return, Reject. Remarks required on Return and Reject. Email notification |
| 3   | If/else                             | Approved goes to node 4. Returned pauses for the loan officer, then resubmit returns to node 2. Rejected goes to the reject path      |
| 4   | Update Metadata                     | Status In Level 2                                                                                                                     |
| 5   | Approval, Level 2 (Credit approver) | Same tabs, plus sanction fields: Sanctioned Amount, Sanction Date, remarks. Actions: Approve, Return, Reject                          |
| 6   | If/else                             | Approved goes to completion. Returned goes to the loan officer. Rejected goes to the reject path                                      |
| 7   | Completion                          | Create the master record with status Approved. Apply DocType tags. Store files in folders. Email the loan officer                     |
| 8   | End                                 |                                                                                                                                       |
| R   | Reject path                         | Status Rejected, email with reason, End. No master record. Files stay in the workflow                                                 |

Show the workflow both as a **builder canvas** (read-only, once, to explain it) and as an **instance view** with progress per node.

## 10. On approval: master, DocTypes, folders

**Master record:** all form data plus the approval fields and KYC result. Status Approved.

**DocTypes** (each 1:1 with a file):

| Group    | DocTypes                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| KYC      | PAN Card, Aadhaar (Masked Copy), Photograph, Address Proof                                                                  |
| Income   | Income Proof, GST Certificate or Business Licence, Surety Documents                                                         |
| Property | Sale or Gift Deed, Records of Rights, Encumbrance Certificate, Building Permission, Valuation Certificate, Tax Paid Receipt |

Required documents depend on Loan Purpose. For the demo, the full list is required for Construction of house.

**Folder structure:**

```
Loans
  Home Loan
    {Branch}
      {Application ID} {Applicant name}
        01 KYC
        02 Income
        03 Property
        04 Sanction
```

Each stored file shows its DocType tag and a link to the master record. `04 Sanction` holds an optional mock "Sanction Summary" PDF generated on approval.

## 11. Audit trail (per application)

Events, each with user, time, and old and new value where relevant:

Application created, field changed, document uploaded, consent given, KYC check run (with outcome and a mock reference ID), KYC result set, submitted, workflow started, Level 1 decision, returned, resubmitted, Level 2 decision, record created, files stored, rejected. Aadhaar is always masked in the trail.

## 12. Screens and build order

Build in this order. After each step, stop and let me review.

| Step | Screens                                                                       | Notes                                                              |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0    | App shell, DMS+ theme, mock store, seed data, scenario switcher, Reset        | Foundation. No feature screens yet                                 |
| 1    | S2 Step 1 form, S3 consent                                                    | Sections in 6.1 to 6.6, conditional fields, all inline validations |
| 2    | S4 Step 2 KYC, S5 Review and submit                                           | Mocked checks, OTP pop-up, side-by-side result, gating, remark box |
| 3    | S6 Workflow instance, S7 Level 1 task, S8 Level 2 task, S12 Return and reject | Workflow behaviour in section 9                                    |
| 4    | S9 Approved master record, S10 Folder view, S11 Audit trail                   | Section 10 and 11                                                  |
| 5    | S1 Applications list, navigation, wiring                                      | Stitch the journey                                                 |

## 13. Demo scenarios (seed data, dummy values)

|                | A: Clean pass (main demo)                         | B: Exception                                                  | C: Fail                             |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| Applicant      | Ramesh Patil, Business                            | Anita Desai, Salaried                                         | Kiran Naik, Salaried                |
| Date of birth  | 14-03-1984                                        | 02-09-1990                                                    | 21-06-1988                          |
| PAN            | ABCPP1234F                                        | ABCPD5678K                                                    | ABCPD9012L                          |
| Aadhaar        | A Verhoeff-valid dummy ending 4821                | A Verhoeff-valid dummy ending 7733                            | A Verhoeff-valid dummy ending 2290  |
| GSTIN          | 29ABCPP1234F1Z5                                   | none                                                          | none                                |
| Loan           | 18,00,000, construction, 180 months               | 12,00,000, 120 months                                         | 10,00,000, 120 months               |
| Estimated cost | 26,00,000 (eligible 19,50,000)                    | 16,50,000 (eligible 12,37,500)                                | 14,00,000                           |
| KYC outcome    | All verified, name match 100%                     | Name "Anita Desai" against "ANITA R DESAI", 86%, so Exception | PAN inactive, so Fail               |
| Demo path      | Both levels approve, record created, files stored | Officer adds a remark, both approvers see the Exception badge | Submit blocked with a clear message |

Also seed a few existing applications in different statuses for the list screen. For the amount rule demo, entering 22,00,000 on scenario A must fire the 75% message.

## 14. Out of scope

Real API calls, real authentication, real file storage or OCR, mobile layout, KYC for co-applicant and sureties, loan products other than Home Loan, loan accounting and disbursement.

## 15. UI references

Design screens are in `/design`. Use them for look and behaviour:

- Names start with the screen number, for example `S2-step1-form.png`.
- Shared references (shell, navigation, master form, workflow, folder view) are in `/design/core`.
- If a screen has no reference, ask me before designing it.

## 16. Open items (treat as assumptions)

- The bank's page says age 18 to 55 but also asks for a co-applicant above 60. The prototype uses 18 to 55.
- The bank's website was last updated in 2021, so loan limits and rules need the bank's confirmation.
- Approver titles (Branch Manager, Credit approver) are assumed.
- The platform behaviours behind this demo (a master form submit starting a workflow before the record exists, API-backed fields, conditional and calculated fields, filing to folders on approval) are confirmed with engineering separately. The prototype simply shows them.
