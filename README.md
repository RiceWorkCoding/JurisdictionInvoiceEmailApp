# Invoice Recipient Email System

## Overview

The Invoice Recipient Email System is a SuiteScript 2.1 solution designed to streamline the creation, review, distribution, and archival of jurisdictional invoices within NetSuite.

The solution provides users with a centralized interface for:

* Managing invoice recipient records
* Uploading supporting documentation
* Previewing invoice templates
* Sending invoices via email
* Generating PDF invoice copies
* Logging outbound email activity
* Maintaining historical invoice records

The system consists of four scripts working together to provide a complete invoice processing workflow.

---

# Architecture

```text
Invoice Recipient Record
        │
        ▼
┌──────────────────────────────┐
│ Invoice Management Suitelet  │
│ (Main User Interface)        │
└──────────────┬───────────────┘
               │
      Preview Invoice
               ▼
┌──────────────────────────────┐
│ Invoice Preview Suitelet     │
│ (HTML Invoice Renderer)      │
└──────────────┬───────────────┘
               │
         Send Invoice
               ▼
┌──────────────────────────────┐
│ Invoice Email Suitelet       │
│ (PDF + Email Processor)      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Email Log Record             │
└──────────────────────────────┘

               ▼

┌──────────────────────────────┐
│ Jurisdiction Invoice Archive │
└──────────────────────────────┘
```

---

# Components

## 1. Invoice Management Suitelet

### Script Type

Suitelet

### Purpose

Provides the primary user interface for maintaining Invoice Recipient records.

### Features

* View invoice details
* Edit invoice fields
* Upload supporting documents
* View external recipient groups
* View internal CC recipient groups
* Preview invoice
* Send invoice
* Create file cabinet folders automatically
* Store uploaded attachments

### Key Record Type

```text
customrecord_invoice_recipient
```

### Saved Searches

```text
customsearch_email_group_jur
customsearch_email_group_jur_cc
```

### Attached Documents

* Expenditure Report
* Document 2
* Document 3

### File Cabinet Behavior

If no folder exists for a record:

1. Creates a folder automatically
2. Names folder:

```text
<Record ID> - <Jurisdiction Name>
```

3. Stores folder ID on the Invoice Recipient record

---

## 2. Invoice Preview Suitelet

### Script Type

Suitelet

### Purpose

Renders a browser-based preview of the invoice prior to sending.

### Features

* Displays invoice layout
* Formats dates
* Formats currency
* Displays recipient information
* Displays payment instructions
* Displays assigned contact information

### Data Source

```text
customrecord_invoice_recipient
```

### Output

HTML invoice rendered directly in browser.

### Usage

Accessed from the **Preview Email** button in the Invoice Management Suitelet.

---

## 3. Invoice Email Processing Suitelet

### Script Type

Suitelet

### Purpose

Processes invoice delivery.

### Features

* Generates PDF invoice
* Builds HTML email body
* Retrieves recipient lists
* Loads supporting attachments
* Sends email
* Creates email log record
* Archives invoice information
* Stores generated PDF

### Email Delivery Logic

If recipient count is less than or equal to 9:

```javascript
email.send()
```

If recipient count exceeds 9:

```javascript
email.sendBulk()
```

### Attachments Included

| Attachment         | Source                   |
| ------------------ | ------------------------ |
| PDF Invoice        | Generated dynamically    |
| Expenditure Report | Invoice Recipient Record |
| Document 2         | Invoice Recipient Record |
| Document 3         | Invoice Recipient Record |

### Email Log Record

Creates:

```text
customrecord_invoice_recipient_email_log
```

Stores:

* Sent date
* Subject
* Recipients
* Email body
* PDF attachment
* Parent record

### Invoice Archive Record

Creates or updates:

```text
customrecord_jur_invoice_info
```

Used as the permanent invoice archive.

---

## 4. Invoice Client Script

### Script Type

Client Script

### Purpose

Provides user interaction for the Suitelet interface.

### Functions

#### pageInit()

Loads when the form is opened.

#### goBackToRecord()

Returns user to the Invoice Management Suitelet.

#### previewEmailTemplate()

Opens invoice preview window.

#### sendInvoiceEmail()

Invokes the Invoice Email Suitelet via fetch request.

Displays success or failure message to user.

---

# Record Dependencies

## Primary Record

```text
customrecord_invoice_recipient
```

## Email Log Record

```text
customrecord_invoice_recipient_email_log
```

## Invoice Archive Record

```text
customrecord_jur_invoice_info
```

## Folder Record

```text
folder
```

---

# Saved Search Dependencies

The following saved searches must exist:

```text
customsearch_email_group_jur
customsearch_email_group_jur_cc
```

---

# Script Dependencies

## Invoice Management Suitelet

Modules:

```javascript
N/ui/serverWidget
N/record
N/log
N/search
N/file
```

## Invoice Preview Suitelet

Modules:

```javascript
N/record
N/log
```

## Invoice Email Suitelet

Modules:

```javascript
N/record
N/log
N/render
N/email
N/runtime
N/search
N/file
```

## Client Script

Modules:

```javascript
N/url
N/currentRecord
```

---

# Deployment Requirements

## Update Script IDs

The following placeholders must be reviewed:

### Preview Suitelet

```javascript
customscript_email_preview_suitelet
customdeploy_preview_email_suitelet
```

### Send Email Suitelet

```javascript
customscript_ir_send_email_action
customdeploy_ir_send_email_action
```

---

## Update File Cabinet Folder IDs

Review hardcoded folder references:

```javascript
157362
```

Ensure folder IDs are valid in the target environment.

---

## Update Media URLs

Invoice logos and footer images currently reference specific NetSuite account URLs.

Validate all image references when migrating between:

* Sandbox
* Production

---

## Verify Custom Fields

Confirm all custom fields exist in production before deployment.

Examples include:

```text
custrecord_invoice_amount_sf
custrecord_invoice_recipient_fund
custrecord_sf_invoice_num
custrecord_invoice_date
custrecord_invoice_due_date
custrecord_email_group
custrecord_expenditure_report
custrecord_invoice_recp_doc_2
custrecord_invoice_recp_doc_3
custrecord_file_cabinet_id
custrecord_po_assigned_to
custrecord_invoice_recp_additional_reqs
```

---

# User Workflow

## Step 1

Open Invoice Recipient record.

## Step 2

Review and update:

* Invoice amount
* Project number
* Invoice number
* Due date
* Assigned employee
* Additional invoice information

## Step 3

Upload supporting documents.

## Step 4

Select:

```text
Preview Email
```

to review invoice appearance.

## Step 5

Select:

```text
Send Email
```

to generate PDF and distribute invoice.

## Step 6

System automatically:

* Generates PDF
* Sends email
* Saves attachments
* Creates email log
* Updates invoice archive

---

# Known Issues

## Invoice Management Suitelet

Typographical error:

```javascript
vale: null
```

Should be:

```javascript
value: null
```

---

Stray character near error handling:

```javascript
... ${e.message}</div>`; A
```

Should be removed.

---

## Invoice Preview Suitelet

CSS syntax issue:

```css
size; A4;
```

Should be:

```css
size: A4;
```

---

## Hardcoded Values

The following should ideally become script parameters:

* Folder IDs
* Contact Group IDs
* Image URLs
* Script IDs
* Deployment IDs

---

# Future Enhancements

## Shared Invoice Template

The invoice layout currently exists in multiple scripts.

Consider moving template generation into:

```text
InvoiceTemplateLibrary.js
```

to reduce duplication.

---

## Configuration Record

Replace hardcoded values with a custom configuration record.

Examples:

* Folder IDs
* Contact Group IDs
* Company Address
* Media URLs

---

## Enhanced Email Logging

Capture:

* Email status
* Send attempts
* Failure reasons
* Attachment names

---

## PDF Versioning

Store historical versions of generated invoices.

---

# Repository Structure

```text
Invoice-Recipient-Email-System/
│
├── InvoiceManagementSuitelet.js
├── InvoicePreviewSuitelet.js
├── InvoiceEmailProcessorSuitelet.js
├── SendInvoiceHandler.js
│
├── README.md
│
└── docs/
    ├── deployment-notes.md
    ├── architecture.md
    └── migration-checklist.md
```

---

# License

Internal Use Only

This solution was developed for NetSuite invoice processing and distribution workflows. Review organizational policies before distributing externally.
