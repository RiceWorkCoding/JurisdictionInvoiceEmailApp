/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * SUMMARY:
 * This Client Script supports the Invoice Recipient Suitelet by providing
 * client-side interactivity including:
 * 
 * 1. pageInit(context):
 *    - Entry point that executes when the Suitelet form loads.
 *    - Currently does no initialization but must be defined for the client script to load properly.
 * 
 * 2. goBackToRecord():
 *    - Triggered by a "Back to Record" button on the Suitelet page.
 *    - Navigates the user back to the Suitelet view of the current Invoice Recipient record
 *      by redirecting to the Suitelet URL with the record ID appended as a parameter.
 *    - Uses the hidden field 'custpage_record_id' on the form to retrieve the record ID.
 *    - Alerts the user if the record ID is missing to prevent a navigation error.
 * 
 * 3. previewEmailTemplate():
 *    - Triggered by a "Preview Email" button on the Suitelet page.
 *    - Opens a new browser window displaying the rendered email template for the current record.
 *    - Uses the NetSuite URL module to dynamically resolve the Suitelet URL for preview,
 *      passing the current record ID as a parameter.
 *    - Alerts the user if the record ID is missing.
 *    - Opens the email preview window with a fixed size of 900x800 pixels.
 * 
 * NOTES FOR DEPLOYMENT:
 * - Replace the placeholder scriptId and deploymentId in previewEmailTemplate with your actual Suitelet script and deployment IDs.
 * - The 'custpage_record_id' field must be present and populated on the Suitelet form for this script to work correctly.
 * - Buttons on the Suitelet form should be wired to call goBackToRecord() and previewEmailTemplate() respectively.
 */

define(['N/url', 'N/currentRecord'], function (url, currentRecord) {

    /**
     * Entry point called when the form loads.
     * Required by NetSuite client scripts even if no initialization is needed.
     * @param {Object} context - Context containing currentRecord and mode.
     */
    function pageInit(context) {
        // No initialization needed at this time
    }

    /**
     * Navigates back to the Suitelet record view.
     * Reads the record ID from the hidden field 'custpage_record_id' and
     * redirects the browser to the Suitelet URL with the record ID as a URL parameter.
     * Alerts the user if the record ID is missing.
     */
    function goBackToRecord() {
        // var recordIdField = document.getElementById('custpage_record_id');
        // if (recordIdField && recordIdField.value) {
        //     // Construct Suitelet URL with record ID parameter
        //     window.location.href = '/app/site/hosting/scriptlet.nl?script=2574&deploy=1&customRecordId=' + recordIdField.value;
        // } else {
        //     alert('Record ID missing');
        // }
        var rec = currentRecord.get();
        var recordId = rec.getValue({ fieldId: 'custpage_record_id' });

        if (recordId) {
            window.location.href = '/app/site/hosting/scriptlet.nl?script=2574&deploy=1&customRecordId=' + recordId;
        } else {
            alert('Record ID missing');
        }

    }

    /**
     * Opens a new window to preview the rendered email template.
     * Uses the current record's ID and NetSuite URL module to build
     * the URL to the preview Suitelet, then opens it in a popup window.
     * Alerts the user if the record ID cannot be found.
     */
    function previewEmailTemplate() {
        // Get the current record in the UI
        var rec = currentRecord.get();
        var recordId = rec.getValue({ fieldId: 'custpage_record_id' });

        if (!recordId) {
            alert('No record ID found. Cannot preview email.');
            return;
        }

        // Dynamically resolve Suitelet URL for email preview
        var suiteletUrl = url.resolveScript({
            scriptId: 'customscript_email_preview_suitelet',         // 🔁 Replace with your actual script ID
            deploymentId: 'customdeploy_preview_email_suitelet',     // 🔁 Replace with your actual deployment ID
            params: {
                customRecordId: recordId
            }
        });

        // Open preview in a new window with fixed dimensions
        window.open(suiteletUrl, '_blank', 'width=900,height=800');
    }

    function sendInvoiceEmail() {
        //alert('Send Invoice Email button clicked!');
        var rec = currentRecord.get();
        var recordId = rec.getValue({ fieldId: 'custpage_record_id' });

        if (!recordId) {
            alert('No record ID found. Cannot send email.');
            return;
        }

        var sendEmailUrl = url.resolveScript({
            scriptId: 'customscript_ir_send_email_action',      // updated scriptId
            deploymentId: 'customdeploy_ir_send_email_action'   // updated deploymentId
        });

        fetch(sendEmailUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                customRecordId: recordId
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert(`✅ Email sent successfully to: ${data.sentTo.join(', ')}`);
                } else {
                    alert(`❌ Email sending failed: ${data.message}`);
                }
            })
            .catch(error => {
                alert(`❌ Unexpected error: ${error.message}`);
            });
    }

    /**
     * Export the functions to be used by NetSuite and form buttons.
     */
    return {
        pageInit: pageInit,
        goBackToRecord: goBackToRecord,
        previewEmailTemplate: previewEmailTemplate,
        sendInvoiceEmail: sendInvoiceEmail
    };
});
