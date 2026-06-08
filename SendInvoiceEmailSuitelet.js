/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * SUMMARY:
 * This Suitelet sends an email with a PDF invoice attachment based on a
 * custom Invoice Recipient record (customrecord_invoice_recipient).
 * 
 * It performs the following key functions:
 * - Receives a parameter 'customRecordId' for loading the invoice recipient record.
 * - Loads data fields from that record to populate the email body and invoice PDF.
 * - Generates a PDF from an HTML template using record data.
 * - Retrieves a contact group from a saved search to determine recipients.
 * - Optionally attaches additional files uploaded to the record.
 * - Sends the email to the contact group with PDF attachment(s).
 * - Logs the email details into a custom subrecord (customrecord_invoice_recipient_email_log).
 * - Saves the PDF invoice to a folder dynamically created/named based on the invoice recipient record.
 * 
 * IMPORTANT NOTES FOR SANDBOX VS PRODUCTION:
 * - Ensure all custom field IDs and saved search IDs used in this script exist and are consistent in production.
 * - Verify file cabinet folder permissions and existence of template files or images used in email.
 * - Update internal media item IDs (e.g., logo images) if they differ between environments.
 * - Adjust logging or debugging as needed for production.
 */

define(['N/record', 'N/log', 'N/render', 'N/email', 'N/runtime', 'N/search', 'N/file'],
    function (record, log, render, email, runtime, search, file) {

        function onRequest(context) {
            const request = context.request;
            const response = context.response;

            const recordId = request.parameters.customRecordId;
            const currentUserId = runtime.getCurrentUser().id;

            if (!recordId) {
                response.write(JSON.stringify({ success: false, message: 'No record ID provided.' }));
                return;
            }

            // Helper to format dates as MM/DD/YYYY
            function formatDate(dateValue) {
                if (!dateValue) return '';
                let d = (dateValue instanceof Date) ? dateValue : new Date(dateValue);
                if (isNaN(d.getTime())) return '';
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const yyyy = d.getFullYear();
                return `${mm}/${dd}/${yyyy}`;
            }

            function xmlEscape(str) {
                if (!str) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
            }

            try {
                // Load the invoice recipient record
                const customRec = record.load({
                    type: 'customrecord_invoice_recipient',
                    id: recordId
                });

                // Helper to safely get field values
                function getVal(fieldId) {
                    return customRec.getValue({ fieldId }) || '';
                }

                // Prepare data for template
                const data = {
                    addr1: getVal('custrecord_invoice_recp_adressee1'),
                    street: getVal('custrecord_invoice_recp_street_address'),
                    city: getVal('custrecord_invoice_recp_city'),
                    state: getVal('custrecord_invoice_recp_state'),
                    zip: getVal('custrecord_invoice_recp_zip_code'),
                    amount: getVal('custrecord_invoice_amount_sf'),
                    projectNum: getVal('custrecord_invoice_recipient_fund'),
                    invoiceNum: getVal('custrecord_sf_invoice_num'),
                    invoiceDate: formatDate(getVal('custrecord_invoice_date')),
                    dueDate: formatDate(getVal('custrecord_invoice_due_date')),
                    description: getVal('custrecord_invoice_recipient_purpose'),
                    contactFirstName: getVal('custrecord_assigned_to_frname'),
                    contactLastName: getVal('custrecord_po_assigned_to_laname'),
                    contactTitle: getVal('custrecord_po_assigned_to_title'),
                    contactPhone: getVal('custrecord_po_assigned_phone'),
                    contactEmail: getVal('custrecord_po_assigned_email'),
                    emailGroupId: getVal('custrecord_email_group'),
                    programManagerEmail: getVal('custrecord_po_assigned_email'),
                    additionalInvoiceInfo: getVal('custrecord_invoice_recp_additional_reqs')
                };

                const formattedAmount = parseFloat(data.amount || 0).toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD'
                });

                // Build the HTML email body 
                const htmlBody = `
                <html>
                <head>
                    <title>Invoice</title>
                    <style>
                        body { font-family: Arial, sans-serif; }
                        .header-img { width: 234px; height: 50px; }
                        .invoice-title { font-size: 28pt; font-family: Tahoma; padding-left: 80px; }
                        .content { padding-left: 80px; }
                        .bold-label { font-weight: bold; }
                        .signature { padding-left: 450px; }
                    </style>
                </head>
                <body>
                    <img src="https://8545483.app.netsuite.com/core/media/media.nl?id=6592&amp;c=8545483&amp;h=R6BzjOBAXmAflEjyR6B_8ChgiiWjDAewy3VcFepYzd8YkPnU" alt="" />
    
                    <p class="invoice-title">INVOICE</p>
    
                    <br /><br />
    
                    <div class="content">
                        <span class="bold-label">To:</span> <span style="padding-left: 80px;"> ${data.addr1}</span><br />
                        <span style="padding-left: 108px;">${data.street}</span><br />
                        <span style="padding-left: 108px;">${data.city}, ${data.state} ${data.zip}</span>
                    </div>
    
                    <br /><br />
    
                    <div class="content">
                        <span class="bold-label">Amount:</span> <span style="padding-left: 160px;">${formattedAmount}</span><br /><br />
                        <span class="bold-label">Project #:</span> <span style="padding-left: 155px;">${data.projectNum}</span><br /><br />
                        <span class="bold-label">Invoice#:</span> <span style="padding-left: 160px;">${data.invoiceNum}</span><br /><br />
                        <span class="bold-label">Invoice Date:</span> <span style="padding-left: 135px;">${data.invoiceDate}</span><br /><br />
                        <span class="bold-label">Invoice Due Date:</span> <span style="padding-left: 100px;">${data.dueDate}</span><br /><br />
                        <span class="bold-label">Additional Invoice Information:</span> <span style="padding-left: 100px;">${data.additionalInvoiceInfo}</span>

                    </div>
    
                    <br /><br />
    
                    <div class="content">
                        <span class="bold-label">DESCRIPTION:</span> ${data.description}
                    </div>
    
                    <br /><br />
    
                    <div class="content">
                        <span class="bold-label">Payment Remittance Address:</span><br /><br />
                        CDC FOUNDATION<br />
                        P.O. BOX 748645<br />
                        Atlanta, GA 30374-8645
                    </div>
    
                    <br /><br />
    
                    <div class="content">
                        <span class="bold-label">DIRECT QUESTIONS TO:</span><br />
                        Name: ${data.contactFirstName} ${data.contactLastName}<br />
                        Title: ${data.contactTitle}<br />
                        Phone: ${data.contactPhone}<br />
                        Email: ${data.contactEmail}
                    </div>
    
                    <br /><br />
    
                    <div class="content">
                        <span class="bold-label">INFORMATION:</span><br /><br />
                        Federal Tax Identification No. 58-2106707
                    </div>
    
                    <br /><br />
    
                    <div class="footer">
                        <img style="max-width: 75%; padding-left: 200px" src="https://8545483.app.netsuite.com/core/media/media.nl?id=238895&amp;c=8545483&amp;h=HGmpZdz2Okv_6wQ0hkNrsqlA4Q9h7jaklV5l3PU6OBYUWYzD"/>
                    </div>
                </body>
                </html>`;

                // Build XML string for PDF generation
                const pdfXml = `
                <pdf>
                <head>
                <title>Invoice</title>
                <style>
                    @page {
                        size: A4;
                    }
                    body { font-family: Arial, sans-serif; }
                    .header-img { width: 234px; height: 50px; }
                    .invoice-title { font-size: 28pt; font-family: Tahoma; padding-left: 80px; }
                    .content { padding-left: 80px; }
                    .bold-label { font-weight: bold; }
                    .signature { padding-left: 450px; }
                    body { 
                        transform: scale(0.9);
                        transform-origin: top left;
                    }
                </style>
                </head>
                <body>
                
                <img src="https://8545483.app.netsuite.com/core/media/media.nl?id=6592&amp;c=8545483&amp;h=R6BzjOBAXmAflEjyR6B_8ChgiiWjDAewy3VcFepYzd8YkPnU" />
                
                <p class="invoice-title">INVOICE</p>
                
                <br />
                
                <div class="content">
                    <span class="bold-label">To:</span>
                    <span style="padding-left: 80px;">${xmlEscape(data.addr1)}</span><br />
                    <span style="padding-left: 108px;">${xmlEscape(data.street)}</span><br />
                    <span style="padding-left: 108px;">${xmlEscape(data.city)}, ${xmlEscape(data.state)} ${xmlEscape(data.zip)}</span>
                </div>
                
                <br />
                
                <div class="content">
                    <span class="bold-label">Amount:</span>
                    <span style="padding-left: 160px;">${xmlEscape(formattedAmount)}</span><br /><br />
                
                    <span class="bold-label">Project #:</span>
                    <span style="padding-left: 155px;">${xmlEscape(data.projectNum)}</span><br /><br />
                
                    <span class="bold-label">Invoice#:</span>
                    <span style="padding-left: 160px;">${xmlEscape(data.invoiceNum)}</span><br /><br />
                
                    <span class="bold-label">Invoice Date:</span>
                    <span style="padding-left: 135px;">${xmlEscape(data.invoiceDate)}</span><br /><br />
                
                    <span class="bold-label">Invoice Due Date:</span>
                    <span style="padding-left: 100px;">${xmlEscape(data.dueDate)}</span><br /><br />
                
                    <span class="bold-label">Additional Invoice Information:</span>
                    <span style="padding-left: 100px;">${xmlEscape(data.additionalInvoiceInfo)}</span>
                </div>
                
                <br />
                
                <div class="content">
                    <span class="bold-label">DESCRIPTION:</span>
                    ${xmlEscape(data.description)}
                </div>
                
                <br />
                
                <div class="content">
                    <span class="bold-label">Payment Remittance Address:</span><br /><br />
                    CDC FOUNDATION<br />
                    P.O. BOX 748645<br />
                    Atlanta, GA 30374-8645
                </div>
                
                <br />
                
                <div class="content">
                    <span class="bold-label">DIRECT QUESTIONS TO:</span><br />
                    Name: ${xmlEscape(data.contactFirstName)} ${xmlEscape(data.contactLastName)}<br />
                    Title: ${xmlEscape(data.contactTitle)}<br />
                    Phone: ${xmlEscape(data.contactPhone)}<br />
                    Email: ${xmlEscape(data.contactEmail)}
                </div>
                
                <br />
                
                <div class="content">
                    <span class="bold-label">INFORMATION:</span><br /><br />
                    Federal Tax Identification No. 58-2106707
                </div>
                
                <br />
                
                <div class="footer">
                    <img style="max-width: 75%; padding-left: 200px"
                    src="https://8545483.app.netsuite.com/core/media/media.nl?id=238895&amp;c=8545483&amp;h=HGmpZdz2Okv_6wQ0hkNrsqlA4Q9h7jaklV5l3PU6OBYUWYzD"/>
                </div>
                
                </body>
                </pdf>`;
                // Generate PDF file from XML
                const pdfFile = render.xmlToPdf({ xmlString: pdfXml });
                pdfFile.name = `Invoice_${data.invoiceNum}.pdf`

                //Load Email Group
                const emailGroupId = customRec.getValue('custrecord_email_group');
                if (!emailGroupId) {
                    response.write(JSON.stringify({ success: false, message: 'No email Group' }))
                    return;
                }

                const contactSearch = search.load({ id: 'customsearch_email_group_jur' });
                contactSearch.filters.push(
                    search.createFilter({
                        name: 'group',
                        operator: search.Operator.ANYOF,
                        values: [emailGroupId]
                    })
                );

                // Prepare recipient emails array
                let recipientEmails = [];
                contactSearch.run().each(function (result) {
                    const email = result.getValue({ name: 'email' });
                    if (email) {
                        recipientEmails.push(email);
                    }
                    return true;
                });

                log.debug({
                    title: 'Email Recipients',
                    details: JSON.stringify(recipientEmails)
                });

                if (recipientEmails.length === 0) {
                    response.write(JSON.stringify({ success: false, message: 'No recipient emails found. ' }));
                    return;
                }

                //Load CC Email Group
                const contactSearchEmailCC = search.load({ id: 'customsearch_email_group_jur_cc' });
                contactSearchEmailCC.filters.push(
                    search.createFilter({
                        name: 'group',
                        operator: search.Operator.ANYOF,
                        values: 263421
                    })
                );


                //Prepare cc emails array
                let ccEmails = [];
                contactSearchEmailCC.run().each(function (result) {
                    const emailCC = result.getValue({ name: 'email' });
                    if (emailCC) {
                        ccEmails.push(emailCC);
                    }
                    return true;
                });

                log.debug({
                    title: 'CC Email Recipients',
                    details: JSON.stringify(ccEmails)
                });

                if (ccEmails.length === 0) {
                    response.write(JSON.stringify({ success: false, message: 'No cc recipient emails found. ' }));
                    return;
                }

                // Send email with HTML body and PDF attachments
                const expenditureReportId = customRec.getValue({ fieldId: 'custrecord_expenditure_report' });
                const doc2Id = customRec.getValue({ fieldId: 'custrecord_invoice_recp_doc_2' });
                const doc3Id = customRec.getValue({ fieldId: 'custrecord_invoice_recp_doc_3' });
                let attachments = [pdfFile];

                if (expenditureReportId) {
                    try {
                        const expenditureReportFileSend = file.load({ id: expenditureReportId });
                        attachments.push(expenditureReportFileSend);
                    } catch (fileErr) {
                        log.error('Failed to load expenditure report file', fileErr);
                    }
                }

                if (doc2Id) {
                    try {
                        const doc2FileSend = file.load({ id: doc2Id });
                        attachments.push(doc2FileSend)
                    } catch (fileErr) {
                        log.error('No Document 2 present/loaded', fileErr);
                    }
                }

                if (doc3Id) {
                    try {
                        const doc3FileSend = file.load({ id: doc3Id });
                        attachments.push(doc3FileSend)
                    } catch (fileErr) {
                        log.error('No Document 3 present/loaded', fileErr);
                    }
                }


                const expenditureReportDoc = customRec.getValue({ fieldId: 'custrecord_expenditure_report' });

                if (recipientEmails.length + ccEmails.length <= 9) {
                    email.send({
                        author: currentUserId, // Will send as user of the App
                        recipients: recipientEmails,
                        cc: [...ccEmails, data.programManagerEmail],
                        replyTo: data.programManagerEmail,
                        subject: `Invoice #${data.invoiceNum}`,
                        body: htmlBody,
                        attachments: attachments,
                        records: {
                            record: {//Saves email to Invoice Recipient Record
                                type: 'customrecord_invoice_recipient',
                                id: recordId
                            }
                        }
                    });
                } else {

                    for (let i = 0; i < ccEmails.length; i++) {
                        recipientEmails.push(ccEmails[i]);
                    }

                    recipientEmails.push(data.programManagerEmail);

                    email.sendBulk({
                        author: currentUserId,
                        recipients: recipientEmails,
                        replyTo: data.programManagerEmail,
                        subject: `Invoice #${data.invoiceNum}`,
                        body: htmlBody,
                        attachments: attachments,
                        records: {
                            record: {//Saves email to Invoice Recipient Record
                                type: 'customrecord_invoice_recipient',
                                id: recordId
                            }
                        }
                    });
                }

                //Create Email Log Record
                const folderId = customRec.getValue({ fieldId: 'custrecord_file_cabinet_id' });
                const jurName = customRec.getValue({ fieldId: 'name'});

                let savedPdf;

                if (folderId) {
                    pdfFile.folder = folderId;
                    savedPdf = pdfFile.save();
                }

                const emailLogId = record.create({
                    type: 'customrecord_invoice_recipient_email_log',
                    isDynamic: true
                })
                    .setValue({ fieldId: 'name', value: `Invoice Email Log - ${data.invoiceNum}` })
                    .setValue({ fieldId: 'custrecord_email_log_parent', value: recordId })
                    .setValue({ fieldId: 'custrecord_email_log_date_sent', value: new Date() })
                    .setValue({ fieldId: 'custrecord_email_log_recipients', value: recipientEmails.join(', ') })
                    .setValue({ fieldId: 'custrecord_email_log_subject', value: `Invoice #${data.invoiceNum}` })
                    .setValue({ fieldId: 'custrecord_email_log_body', value: htmlBody }) // ✅ actual email body
                    .setValue({ fieldId: 'custrecord_email_log_pdf', value: savedPdf }) // ✅ PDF file ID
                    .save();

                log.debug('Email Log Created', `Log ID: ${emailLogId}`);

                //Create Jurisdiction Invoice Information Record
                //Saved Search for Jurisdiction Invoice Information
                const invoiceDueDate = customRec.getValue({ fieldId: 'custrecord_invoice_due_date' });

                // 1. Look for existing record with the same Salesforce Invoice #
                let jurInvoiceId;
                const jurSearch = search.create({
                    type: 'customrecord_jur_invoice_info',
                    filters: [
                        ['custrecord_salesforce_invoice_num', 'is', data.invoiceNum]
                    ],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                if (jurSearch && jurSearch.length > 0) {
                    jurInvoiceId = jurSearch[0].getValue('internalid');
                }

                // 2. Load existing OR create new
                let jurInvoiceRec;
                if (jurInvoiceId) {
                    jurInvoiceRec = record.load({
                        type: 'customrecord_jur_invoice_info',
                        id: jurInvoiceId,
                        isDynamic: true
                    });
                    log.debug('Updating existing Jur Invoice Info', jurInvoiceId);
                } else {
                    jurInvoiceRec = record.create({
                        type: 'customrecord_jur_invoice_info',
                        isDynamic: true
                    });
                    log.debug('Creating new Jur Invoice Info', data.invoiceNum);
                }

                // 3. Set/update field values
                jurInvoiceRec
                    .setValue({ fieldId: 'name', value: `Invoice - ${data.invoiceNum}` })
                    .setValue({ fieldId: 'custrecord_jur_name', value: jurName})
                    .setValue({ fieldId: 'custrecord_salesforce_invoice_num', value: data.invoiceNum })
                    .setValue({ fieldId: 'custrecord_invoice_pdf', value: savedPdf })
                    .setValue({ fieldId: 'custrecord_document_1_invoice', value: expenditureReportId })
                    .setValue({ fieldId: 'custrecord_document_2_invoice', value: doc2Id })
                    .setValue({ fieldId: 'custrecord_document_3_invoice', value: doc3Id })
                    .setValue({ fieldId: 'custrecord_jur_invoice_due_date', value: invoiceDueDate });

                // 4. Save record
                const jurInvoiceInfoId = jurInvoiceRec.save();
                log.debug('Jur Invoice Info Saved', jurInvoiceInfoId);

                // const jurInvoiceInfo = record.create({
                //     type: 'customrecord_jur_invoice_info',
                //     isDynamic: true
                // })
                //     .setValue({ fieldId: 'name', value: `Invoice - ${data.invoiceNum}`})
                //     .setValue({ fieldId: 'custrecord_salesforce_invoice_num', value: data.invoiceNum})
                //     .setValue({ fieldId: 'custrecord_invoice_pdf', value: savedPdf})
                //     .setValue({ fieldId: 'custrecord_document_1_invoice', value: expenditureReportId})
                //     .setValue({ fieldId: 'custrecord_document_2_invoice', value: doc2Id})
                //     .setValue({ fieldId: 'custrecord_document_3_invoice', value: doc3Id})
                //     .setValue({ fieldId: 'custrecord_jur_invoice_due_date', value: invoiceDueDate})
                //     .save();

                const finalResponse = {
                    success: true,
                    sentTo: recipientEmails,
                    ccEmails,
                    programManagerEmail: data.programManagerEmail
                };
                
                log.debug('FINAL RESPONSE', JSON.stringify(finalResponse));
                
                response.write(JSON.stringify(finalResponse));

                //response.write(JSON.stringify({ success: true, sentTo: recipientEmails, ccEmails, programManagerEmail: data.programManagerEmail }));

            } catch (e) {
                log.error('Send Email Error', e);
                response.write(JSON.stringify({ success: false, message: e.message }));
            }
        }

        return {
            onRequest
        };
    });
