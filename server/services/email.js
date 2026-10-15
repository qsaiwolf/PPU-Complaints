/**
 * Notification Service (Email Engine with Console Simulation)
 */
import { config } from '../config/env.js';

class NotificationService {
  async sendComplaintConfirmation({ email, fullName, complaintId, title, serviceName }) {
    if (!config.enableEmailLog) return;

    const message = `
================================================================================
[OUTGOING EMAIL NOTIFICATION] (Simulation)
--------------------------------------------------------------------------------
To     : ${fullName} <${email}>
Subject: Complaint Confirmation #${complaintId} - PPU Complaints System
Body   :
Dear ${fullName},
Your complaint has been successfully registered under department: ${serviceName}.
- Tracking ID : ${complaintId}
- Subject     : ${title}
You can track updates and official replies anytime via the tracking portal using your ID.
Regards,
Complaints & Student Support Unit - Palestine Polytechnic University
================================================================================
    `.trim();

    console.log(message);
  }

  async sendComplaintResolvedNotification({ email, fullName, complaintId, officialReply }) {
    if (!config.enableEmailLog) return;

    const message = `
================================================================================
[OUTGOING EMAIL NOTIFICATION] (Simulation)
--------------------------------------------------------------------------------
To     : ${fullName} <${email}>
Subject: Complaint Resolved #${complaintId} - PPU Complaints System
Body   :
Dear ${fullName},
Your complaint has been successfully resolved.
Official Resolution Reply:
"${officialReply}"

Please visit the tracking portal to rate our service quality and help us improve.
Regards,
University Administration - Palestine Polytechnic University
================================================================================
    `.trim();

    console.log(message);
  }
}

export default new NotificationService();
