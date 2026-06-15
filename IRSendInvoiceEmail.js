/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * SUMMARY:
 * This Suitelet allows users to view and edit a custom Invoice Recipient record (`customrecord_invoice_recipient`) in NetSuite.
 * - On GET: 
 *   - Loads and displays key invoice fields (name, amount, project #, dates, etc.)
 *   - Displays uploaded attachments (Expenditure Report, Doc2, Doc3)
 *   - Displays contact group members based on a saved search
 *   - Provides file upload inputs and preview/send email buttons
 * - On POST:
 *   - Updates invoice fields
 *   - Saves uploaded files into a specific folder (creating one if needed)
 *   - Links files to the record and confirms the update
 *
 * 🔁 MIGRATION NOTES (Sandbox to Production):
 * - Update `form.clientScriptModulePath` to match production folder structure
 * - Update parent folder ID for file uploads (currently hardcoded: `117646`)
 * - Confirm saved search ID for email group (`customsearch_email_group_jur`) exists in production
 * - Double-check all custom field IDs (`custrecord_...`, `custpage_...`) match production setup
 */

define(['N/ui/serverWidget', 'N/record', 'N/log', 'N/search', 'N/file'],
    function (ui, record, log, search, file) {

        function onRequest(context) {
            const request = context.request;
            const response = context.response;

            const customRecordId = request.parameters.customRecordId;

            // Build a basic form
            const form = ui.createForm({ title: 'Invoice Recipient Invoice Email Sender' });

            // Load client script that handles Preview and Send Email button actions
            form.clientScriptModulePath = 'SuiteScripts/SendInvoiceHandler.js'; // ✅ Update in production

            // If no record ID and it's a GET request, display an error
            if (!customRecordId && request.method === 'GET') {
                form.addField({
                    id: 'custpage_no_id',
                    type: ui.FieldType.INLINEHTML,
                    label: ' '
                }).defaultValue = `<div style="color:red;">❌ No record ID provided in URL.</div>`;
                response.writePage(form);
                return;
            }

            // ===============================
            // 🟢 HANDLE GET REQUEST
            // ===============================
            if (request.method === 'GET') {
                try {
                    // Load custom record by internal ID
                    const rec = record.load({
                        type: 'customrecord_invoice_recipient',
                        id: customRecordId
                    });

                    // Pull record field values
                    const name = rec.getValue({ fieldId: 'name' });
                    const invoiceAmount = rec.getValue({ fieldId: 'custrecord_invoice_amount_sf' });
                    const projectNum = rec.getValue({ fieldId: 'custrecord_invoice_recipient_fund' });
                    const invoiceNum = rec.getValue({ fieldId: 'custrecord_sf_invoice_num' });
                    const invoiceDate = rec.getValue({ fieldId: 'custrecord_invoice_date' });
                    const invoiceDueDate = rec.getValue({ fieldId: 'custrecord_invoice_due_date' });
                    const emailGroup = rec.getValue({ fieldId: 'custrecord_email_group' });
                    const expenditureReport = rec.getValue({ fieldId: 'custrecord_expenditure_report' });
                    const doc2 = rec.getValue({ fieldId: 'custrecord_invoice_recp_doc_2' });
                    const doc3 = rec.getValue({ fieldId: 'custrecord_invoice_recp_doc_3' });
                    const programManagerFirstName = rec.getValue({ fieldId: 'custrecord_assigned_to_frname' });
                    const programManagerLastName = rec.getValue({ fieldId: 'custrecord_po_assigned_to_laname' });
                    const programManagerEmail = rec.getValue({ fieldId: 'custrecord_po_assigned_email' });
                    const additionalInformation = rec.getValue({ fieldId: 'custrecord_invoice_recp_additional_reqs'});
                    const poAssignedTo = rec.getValue({ fieldId: 'custrecord_po_assigned_to'});

                    // Hidden record ID field for POST
                    form.addField({
                        id: 'custpage_record_id',
                        type: ui.FieldType.TEXT,
                        label: 'Record ID'
                    }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN }).defaultValue = customRecordId;

                    // ===============================
                    // ➤ Invoice Fields
                    // ===============================
                    form.addFieldGroup({ id: 'custpage_main_group', label: 'Invoice Details' }).isSingleColumn = true;

                    form.addField({
                        id: 'custpage_name',
                        type: ui.FieldType.INLINEHTML,
                        label: ' ',
                        container: 'custpage_main_group'
                    }).defaultValue = `<h2>Invoice To Be Sent To: ${name}</h2>`;

                    form.addField({
                        id: 'custpage_invoice_amount',
                        type: ui.FieldType.CURRENCY,
                        label: 'Invoice Amount',
                        container: 'custpage_main_group'
                    }).defaultValue = invoiceAmount;

                    form.addField({
                        id: 'custpage_project_num',
                        type: ui.FieldType.TEXT,
                        label: 'Project #',
                        container: 'custpage_main_group'
                    }).defaultValue = projectNum;

                    form.addField({
                        id: 'custpage_invoice_num',
                        type: ui.FieldType.TEXT,
                        label: 'Invoice #',
                        container: 'custpage_main_group'
                    }).defaultValue = invoiceNum;

                    form.addField({
                        id: 'custpage_invoice_date',
                        type: ui.FieldType.DATE,
                        label: 'Invoice Date',
                        container: 'custpage_main_group'
                    }).defaultValue = invoiceDate;

                    form.addField({
                        id: 'custpage_invoice_due_date',
                        type: ui.FieldType.DATE,
                        label: 'Invoice Due Date',
                        container: 'custpage_main_group'
                    }).defaultValue = invoiceDueDate;

                    form.addField({
                        id: 'custpage_po_assigned_to',
                        type: ui.FieldType.SELECT,
                        label: 'PO Assigned To',
                        source: 'employee',
                        container: 'custpage_main_group'
                    }).defaultValue = poAssignedTo;

                    form.addField({
                        id: 'custpage_additional_info',
                        type: ui.FieldType.TEXTAREA,
                        label: 'Additional Information',
                        container: 'custpage_main_group'
                    }).defaultValue = additionalInformation;

                    // ===============================
                    // ➤ Attachment Section
                    // ===============================
                    form.addFieldGroup({
                        id: 'custpage_attachments_group',
                        label: 'Attachments'
                    }).isSingleColumn = true;

                    // Load file names (if uploaded), or fallback messages
                    let expenditureReportFile = '<div>No Expenditure Report uploaded</div>';
                    let doc2File = '<div>No Document 2 file uploaded</div>';
                    let doc3File = '<div>No Document 3 file uploaded</div>';

                    try {
                        if (expenditureReport) {
                            const file1 = file.load({ id: expenditureReport });
                            expenditureReportFile = `<div><strong>Expenditure Report:</strong> ${file1.name}</div>`;
                        }
                        if (doc2) {
                            const file2 = file.load({ id: doc2 });
                            doc2File = `<div><strong>Document 2:</strong> ${file2.name}</div>`;
                        }
                        if (doc3) {
                            const file3 = file.load({ id: doc3 });
                            doc3File = `<div><strong>Document 3:</strong> ${file3.name}</div>`;
                        }
                    } catch (e) {
                        log.error('File Load Error', e);
                        expenditureReportFile = doc2File = doc3File = '<div style="color:red;">Error loading file</div>';
                    }

                    // Show file names
                    form.addField({
                        id: 'custpage_expenditure_report_name_display',
                        type: ui.FieldType.INLINEHTML,
                        label: 'Expenditure Report File Name',
                        container: 'custpage_attachments_group'
                    }).defaultValue = expenditureReportFile;

                    form.addField({
                        id: 'custpage_doc2_name_display',
                        type: ui.FieldType.INLINEHTML,
                        label: 'Doc 2 File Name',
                        container: 'custpage_attachments_group'
                    }).defaultValue = doc2File;

                    form.addField({
                        id: 'custpage_doc3_name_display',
                        type: ui.FieldType.INLINEHTML,
                        label: 'Doc 3 File Name',
                        container: 'custpage_attachments_group'
                    }).defaultValue = doc3File;

                    // ===============================
                    // ➤ Email Group Display
                    // ===============================
                    form.addFieldGroup({
                        id: 'custpage_email_group',
                        label: 'Email Group'
                    });

                    try {
                        const contactSearch = search.load({ id: 'customsearch_email_group_jur' }); // ✅ Confirm ID in production
                        contactSearch.filters.push(search.createFilter({
                            name: 'group',
                            operator: search.Operator.ANYOF,
                            values: [emailGroup]
                        }));

                        let emailMembersHtml = `<h3>📧 Members of Contact Group: ${emailGroup} for ${name}</h3><ul>`;

                        contactSearch.run().each(result => {
                            const contactName = result.getValue({ name: 'entityid' }) || '(No Name)';
                            const email = result.getValue({ name: 'email' }) || '(No Email)';
                            emailMembersHtml += `<li>${contactName} - ${email}</li>`;
                            return true;
                        });

                        emailMembersHtml += '</ul>';

                        form.addField({
                            id: 'custpage_email_group_members',
                            type: ui.FieldType.INLINEHTML,
                            label: ' ',
                            container: 'custpage_email_group'
                        }).defaultValue = emailMembersHtml;

                    } catch (e) {
                        log.error('Contact Group Search Error', e);
                        form.addField({
                            id: 'custpage_email_group_error',
                            type: ui.FieldType.INLINEHTML,
                            label: ' ',
                            container: 'custpage_email_group'
                        }).defaultValue = `<div style="color:red;">❌ Could not load group members: ${e.message}</div>`;
                    }
                    //Set up cc group
                    try {
                        const contactSearch = search.load({ id: 'customsearch_email_group_jur_cc' }); // ✅ Confirm ID in production
                        contactSearch.filters.push(search.createFilter({
                            name: 'group',
                            operator: search.Operator.ANYOF,
                            values: 263421 //Internal ID of Jurisdiction Email Group
                        }));

                        let emailMembersInternalHtml = `<h3>📧 Internal Contacts to be Emailed</h3><ul>`;

                        contactSearch.run().each(result => {
                            const contactNameCC = result.getValue({ name: 'entityid' }) || '(No Name)';
                            const emailCC = result.getValue({ name: 'email' }) || '(No Email)';
                            emailMembersInternalHtml += `<li>${contactNameCC} - ${emailCC}</li>`;
                            return true;
                        });

                        //Adds the Internal Contact Information from the Invoice Recipient Record
                        emailMembersInternalHtml += `<li> ${programManagerFirstName} ${programManagerLastName} - ${programManagerEmail}</li>`
                        emailMembersInternalHtml += '</ul>';

                        form.addField({
                            id: 'custpage_email_group_members_internal',
                            type: ui.FieldType.INLINEHTML,
                            label: ' ',
                            container: 'custpage_email_group'
                        }).defaultValue = emailMembersInternalHtml;

                    } catch (e) {
                        log.error('Contact Group Search Error', e);
                        form.addField({
                            id: 'custpage_email_group_cc_error',
                            type: ui.FieldType.INLINEHTML,
                            label: ' ',
                            container: 'custpage_email_group'
                        }).defaultValue = `<div style="color:red;">❌ Could not load group members: ${e.message}</div>`;
                    }


                    // ===============================
                    // ➤ File Upload Section
                    // ===============================
                    form.addField({ id: 'custpage_upload_section', type: ui.FieldType.INLINEHTML, label: ' ' }).defaultValue = `<h2>Add files:</h2>`;

                    form.addField({ id: 'custpage_expenditure_report', type: ui.FieldType.FILE, label: 'Expenditure Report' }).defaultValue = expenditureReport;
                    form.addField({ id: 'custpage_doc2', type: ui.FieldType.FILE, label: 'Document 2' }).defaultValue = doc2;
                    form.addField({ id: 'custpage_doc3', type: ui.FieldType.FILE, label: 'Document 3' }).defaultValue = doc3;

                    // ===============================
                    // ➤ Buttons
                    // ===============================
                    form.addSubmitButton({ label: 'Save Changes/Upload Documents' });
                    form.addButton({ id: 'custpage_preview_email', label: 'Preview Email', functionName: 'previewEmailTemplate' });
                    form.addButton({ id: 'custpage_send_email', label: 'Send Email', functionName: 'sendInvoiceEmail' });

                    response.writePage(form);
                } catch (e) {
                    log.error('Error loading record', e);
                    form.addField({
                        id: 'custpage_error',
                        type: ui.FieldType.INLINEHTML,
                        label: ' '
                    }).defaultValue = `<div style="color:red;">❌ Error loading record: ${e.message}</div>`;
                    response.writePage(form);
                }

                // ===============================
                // 🟠 HANDLE POST REQUEST
                // ===============================
            } else if (request.method === 'POST') {
                try {
                    const submittedId = request.parameters.custpage_record_id;
                    if (!submittedId) throw new Error('No Record ID found in POST parameters.');

                    const rec = record.load({ type: 'customrecord_invoice_recipient', id: submittedId });

                    // Update fields
                    rec.setValue({ fieldId: 'custrecord_invoice_amount_sf', value: request.parameters.custpage_invoice_amount });
                    rec.setValue({ fieldId: 'custrecord_invoice_recipient_fund', value: request.parameters.custpage_project_num });
                    rec.setValue({ fieldId: 'custrecord_sf_invoice_num', value: request.parameters.custpage_invoice_num });
                    rec.setValue({ fieldId: 'custrecord_invoice_recp_additional_reqs', value: request.parameters.custpage_additional_info});
                    rec.setValue({ fieldId: 'custrecord_po_assigned_to', value: request.parameters.custpage_po_assigned_to});

                    const invoiceDate = request.parameters.custpage_invoice_date ? new Date(request.parameters.custpage_invoice_date) : null;
                    const dueDate = request.parameters.custpage_invoice_due_date ? new Date(request.parameters.custpage_invoice_due_date) : null;
                    if (invoiceDate) rec.setValue({ fieldId: 'custrecord_invoice_date', value: invoiceDate });
                    if (dueDate) rec.setValue({ fieldId: 'custrecord_invoice_due_date', value: dueDate });

                    // Uploaded files
                    const uploadedFile = request.files?.custpage_expenditure_report || null;
                    const uploadedFile2 = request.files?.custpage_doc2 || null;
                    const uploadedFile3 = request.files?.custpage_doc3 || null;

                    if (uploadedFile || uploadedFile2 || uploadedFile3) {
                        let folderId = rec.getValue({ fieldId: 'custrecord_file_cabinet_id' });

                        if (!folderId) {
                            const folderName = `${submittedId} - ${rec.getValue({ fieldId: 'name' })}`;
                            const folderRec = record.create({ type: 'folder' });
                            folderRec.setValue({ fieldId: 'name', value: folderName });
                            folderRec.setValue({ fieldId: 'parent', value: 157362 }); // ✅ Update in production
                            folderId = folderRec.save();
                            rec.setValue({ fieldId: 'custrecord_file_cabinet_id', value: folderId });
                        }
                        if (uploadedFile) {
                            uploadedFile.folder = folderId;
                            const fileId = uploadedFile.save();
                            log.debug('Uploaded File 1 Saved', `File ID: ${fileId}`);
                            rec.setValue({ fieldId: 'custrecord_expenditure_report', value: fileId });
                        } else{
                            rec.setValue({ fieldId: 'custrecord_expenditure_report', value: null});
                        }

                        if (uploadedFile2) {
                            uploadedFile2.folder = folderId;
                            const fileId = uploadedFile2.save();
                            log.debug('Uploaded File 2 Saved', `File ID: ${fileId}`);
                            rec.setValue({ fieldId: 'custrecord_invoice_recp_doc_2', value: fileId });
                        } else {
                            rec.setValue({ fieldId: 'custrecord_invoice_recp_doc_2', value: null});
                        }
                        if (uploadedFile3) {
                            uploadedFile3.folder = folderId;
                            const fileId = uploadedFile3.save();
                            log.debug('Uploaded File 3 Saved', `File ID: ${fileId}`);
                            rec.setValue({ fieldId: 'custrecord_invoice_recp_doc_3', value: fileId });
                        } else {
                            rec.setValue({ fieldId: 'custrecord_invoice_recp_doc_3', value: null});
                        }
                    }

                    // Save updated record
                    const savedId = rec.save();
                    const savedName = rec.getValue({ fieldId: 'name' });

                    //Add hidden field for the Back to Record button
                    form.addField({
                        id: 'custpage_record_id',
                        type: ui.FieldType.TEXT,
                        label: 'Record ID'
                    }).updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN })
                        .defaultValue = savedId;

                    // Confirmation message
                    form.addField({
                        id: 'custpage_success',
                        type: ui.FieldType.INLINEHTML,
                        label: ' '
                    }).defaultValue = `<div style="color:green;">✅ Record ${savedId} (${savedName}) saved successfully!</div>`;

                    if (uploadedFile) {
                        form.addField({
                            id: 'custpage_expenditure_success',
                            type: ui.FieldType.INLINEHTML,
                            label: ' '
                        }).defaultValue = `<div style="color:green;">📄 File "${uploadedFile.name}" uploaded and linked to record.</div>`;
                    }
                    if (uploadedFile2) {
                        form.addField({
                            id: 'custpage_doc2_success',
                            type: ui.FieldType.INLINEHTML,
                            label: ' '
                        }).defaultValue = `<div style="color:green;">📄 File "${uploadedFile2.name}" uploaded and linked to record.</div>`;
                    }
                    if (uploadedFile3) {
                        form.addField({
                            id: 'custpage_doc3_success',
                            type: ui.FieldType.INLINEHTML,
                            label: ' '
                        }).defaultValue = `<div style="color:green;">📄 File "${uploadedFile3.name}" uploaded and linked to record.</div>`;
                    }

                    form.addButton({ id: 'back', label: 'Back to Record', functionName: 'goBackToRecord' });
                    response.writePage(form);

                } catch (e) {
                    log.error('Error saving record', e);
                    form.addField({
                        id: 'custpage_error',
                        type: ui.FieldType.INLINEHTML,
                        label: ' '
                    }).defaultValue = `<div style="color:red;">❌ Error saving record: ${e.message}</div>`; 
                    response.writePage(form);
                }
            }
        }

        return { onRequest };
    });
