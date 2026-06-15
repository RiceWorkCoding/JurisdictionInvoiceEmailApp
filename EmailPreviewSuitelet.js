/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * 
 * ==========================
 * SUMMARY
 * ==========================
 * This Suitelet renders an HTML preview of an invoice using data from a custom record
 * (`customrecord_invoice_recipient`). When accessed with a `customRecordId` parameter,
 * it loads the record, retrieves the necessary field values, and builds an HTML page
 * (resembling a formal invoice) for browser viewing.
 * 
 * This script is useful for visualizing how an invoice will appear before sending or exporting.
 * 
 * ==========================
 * TO UPDATE IN PRODUCTION:
 * ==========================
 * - Update the logo/image URLs to production environment (currently points to sandbox).
 * - Confirm all field IDs used in `getVal()` are correct in the production environment.
 * - If email or PDF generation is added, expand `response.write()` handling accordingly.
 */

define(['N/record', 'N/log'], function(record, log) {
    function onRequest(context) {
        const request = context.request;
        const response = context.response;

        // Get the record ID from the request parameters
        const recordId = request.parameters.customRecordId;

        // Handle case when no record ID is provided
        if (!recordId) {
            response.write('<div style="color:red;">❌ No record ID provided.</div>');
            return;
        }

        /**
         * Helper function to format a date value as MM/DD/YYYY
         * Returns empty string if invalid date.
         */
        function formatDate(dateValue) {
            if (!dateValue) return '';
            let d = (dateValue instanceof Date) ? dateValue : new Date(dateValue);
            if (isNaN(d.getTime())) return '';
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${mm}/${dd}/${yyyy}`;
        }

        try {
            // Load the custom invoice recipient record
            const customRec = record.load({
                type: 'customrecord_invoice_recipient',
                id: recordId
            });

            /**
             * Safe field accessor for pulling field values off the loaded record.
             * If the field is blank or null, return an empty string.
             */
            function getVal(fieldId) {
                return customRec.getValue({ fieldId }) || '';
            }

            // Build a data object with field values from the record
            const data = {
                custrecord_invoice_recp_adressee1: getVal('custrecord_invoice_recp_adressee1'),
                custrecord_invoice_recp_street_address: getVal('custrecord_invoice_recp_street_address'),
                custrecord_invoice_recp_city: getVal('custrecord_invoice_recp_city'),
                custrecord_invoice_recp_state: getVal('custrecord_invoice_recp_state'),
                custrecord_invoice_recp_zip_code: getVal('custrecord_invoice_recp_zip_code'),
                custrecord_invoice_amount_sf: getVal('custrecord_invoice_amount_sf'),
                custrecord_invoice_recipient_fund: getVal('custrecord_invoice_recipient_fund'),
                custrecord_sf_invoice_num: getVal('custrecord_sf_invoice_num'),

                // Format date fields using helper
                custrecord_invoice_date: formatDate(getVal('custrecord_invoice_date')),
                custrecord_invoice_due_date: formatDate(getVal('custrecord_invoice_due_date')),

                custrecord_invoice_recipient_purpose: getVal('custrecord_invoice_recipient_purpose'),
                custrecord_assigned_to_frname: getVal('custrecord_assigned_to_frname'),
                custrecord_po_assigned_to_laname: getVal('custrecord_po_assigned_to_laname'),
                custrecord_po_assigned_to_title: getVal('custrecord_po_assigned_to_title'),
                custrecord_po_assigned_phone: getVal('custrecord_po_assigned_phone'),
                custrecord_po_assigned_email: getVal('custrecord_po_assigned_email'),
                custrecord_invoice_recp_additional_reqs: getVal('custrecord_invoice_recp_additional_reqs')
            };

            const formattedAmount = parseFloat(data.custrecord_invoice_amount_sf || 0).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD'
            });


            /**
             * The HTML invoice template below is fully constructed from
             * the data pulled from the custom record above. It includes:
             * - Address
             * - Invoice amount, project number, dates
             * - Contact person details
             * - Signature image (embedded)
             * - Static remittance instructions
             * 
             * NOTE: Update the image source URLs for production if needed.
             */
            const html = `
            <html>
            <head>
                <title>Invoice</title>
                <style>
                    @page {
                        size: A4;
                        margin: 0.5in;
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
                <!-- LOGO (Sandbox and fallback versions) -->
                <img src="https://8545483.app.netsuite.com/app/common/media/mediaitem.nl?id=6592" alt="" />
                <img src="https://8545483-sb1.app.netsuite.com/core/media/media.nl?id=6592&amp;c=8545483_SB1&amp;h=R6BzjOBAXmAflEjyR6B_8ChgiiWjDAewy3VcFepYzd8YkPnU" class="header-img" />

                <p class="invoice-title">INVOICE</p>

                <br /><br />

                <!-- Recipient Address -->
                <div class="content">
                    <span class="bold-label">To:</span> <span style="padding-left: 80px;"> ${data.custrecord_invoice_recp_adressee1}</span><br />
                    <span style="padding-left: 108px;">${data.custrecord_invoice_recp_street_address}</span><br />
                    <span style="padding-left: 108px;">${data.custrecord_invoice_recp_city}, ${data.custrecord_invoice_recp_state} ${data.custrecord_invoice_recp_zip_code}</span>
                </div>

                <br /><br />

                <!-- Invoice Details -->
                <div class="content">
                    <span class="bold-label">Amount:</span> <span style="padding-left: 160px;">${formattedAmount}</span><br /><br />
                    <span class="bold-label">Project #:</span> <span style="padding-left: 155px;">${data.custrecord_invoice_recipient_fund}</span><br /><br />
                    <span class="bold-label">Invoice#:</span> <span style="padding-left: 160px;">${data.custrecord_sf_invoice_num}</span><br /><br />
                    <span class="bold-label">Invoice Date:</span> <span style="padding-left: 135px;">${data.custrecord_invoice_date}</span><br /><br />
                    <span class="bold-label">Invoice Due Date:</span> <span style="padding-left: 100px;">${data.custrecord_invoice_due_date}</span><br /><br />
                    <span class="bold-label">Additional Invoice Information:</span> <span style="padding-left: 100px;">${data.custrecord_invoice_recp_additional_reqs}</span>
                </div>

                <br /><br />

                <!-- Description -->
                <div class="content">
                    <span class="bold-label">DESCRIPTION:</span> ${data.custrecord_invoice_recipient_purpose}
                </div>

                <br /><br />

                <!-- Remittance Instructions -->
                <div class="content">
                    <span class="bold-label">Payment Remittance Address:</span><br /><br />
                    CDC FOUNDATION<br />
                    P.O. BOX 748645<br />
                    Atlanta, GA 30374-8645
                </div>

                <br /><br />

                <!-- Contact Info -->
                <div class="content">
                    <span class="bold-label">DIRECT QUESTIONS TO:</span><br />
                    Name: ${data.custrecord_assigned_to_frname} ${data.custrecord_po_assigned_to_laname}<br />
                    Title: ${data.custrecord_po_assigned_to_title}<br />
                    Phone: ${data.custrecord_po_assigned_phone}<br />
                    Email: ${data.custrecord_po_assigned_email}
                </div>

                <br /><br />

                <!-- Footer / Tax ID -->
                <div class="content">
                    <span class="bold-label">INFORMATION:</span><br /><br />
                    Federal Tax Identification No. 58-2106707
                </div>

                <br /><br />

                <!-- Footer-->
                <div class="footer">
                    <img style="max-width: 75%; padding-left: 200px" src="https://8545483.app.netsuite.com/core/media/media.nl?id=238895&c=8545483&h=HGmpZdz2Okv_6wQ0hkNrsqlA4Q9h7jaklV5l3PU6OBYUWYzD" />
                </div>
            </body>
            </html>`;

            // Write the final HTML to the response
            response.write(html);

        } catch (e) {
            // Log and show error if something goes wrong
            log.error('Error loading record or building template', e);
            response.write(`<div style="color:red;">❌ Error: ${e.message}</div>`);
        }
    }

    return {
        onRequest
    };
});
