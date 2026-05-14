// ── Email Notification System ────────────────────────────────────────────────
// Sends transactional emails at key admissions pipeline moments.
// Uses Supabase Edge Function 'send-email' as the backend.
// Gracefully fails if the edge function is not deployed.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../lib/supabase';

const TEMPLATES = {
  application_submitted: {
    subject: 'Application Received — DDS University',
    getBody: (data) => `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #1e3a5f; color: white; font-weight: 700; padding: 12px 20px; border-radius: 12px; font-size: 18px;">DDS</div>
        </div>
        <h2 style="color: #1e3a5f; font-size: 22px; margin-bottom: 8px;">Application Received! ✅</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
          Hi <strong>${data.name || 'Student'}</strong>,
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
          We've received your application for <strong>${data.branch || 'Engineering'}</strong> at DDS University. 
          Our AI system is now reviewing your profile. You'll receive your Stage 1 score shortly.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="color: #166534; font-size: 14px; margin: 0;">
            <strong>Next step:</strong> Check your dashboard for your AI evaluation score and detailed feedback.
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          DDS University Admissions · Powered by Aria AI
        </p>
      </div>
    `,
  },

  stage1_scored: {
    subject: 'Stage 1 Score Available — DDS University',
    getBody: (data) => `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #1e3a5f; color: white; font-weight: 700; padding: 12px 20px; border-radius: 12px; font-size: 18px;">DDS</div>
        </div>
        <h2 style="color: #1e3a5f; font-size: 22px; margin-bottom: 8px;">Your Stage 1 Score is Ready 📊</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
          Hi <strong>${data.name || 'Student'}</strong>,
        </p>
        <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Your Score</p>
          <p style="color: #1e3a5f; font-size: 48px; font-weight: 700; margin: 0;">${data.score || '--'}<span style="font-size: 18px; color: #9ca3af;">/100</span></p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 8px;">Grade: <strong>${data.grade || '--'}</strong></p>
        </div>
        ${data.passed 
          ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="color: #166534; font-size: 14px; margin: 0;">
                🎉 <strong>Congratulations!</strong> You've passed Stage 1. Stage 2 (Aptitude Test) is now unlocked.
              </p>
            </div>`
          : `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="color: #991b1b; font-size: 14px; margin: 0;">
                Unfortunately, your application did not meet our minimum criteria. Check your dashboard for detailed feedback.
              </p>
            </div>`
        }
        <a href="${data.dashboardUrl || '#'}" style="display: block; text-align: center; background: #1e3a5f; color: white; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 24px;">
          View Full Results →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          DDS University Admissions · Powered by Aria AI
        </p>
      </div>
    `,
  },

  stage2_unlocked: {
    subject: 'Stage 2 Unlocked — Time for Your Aptitude Test!',
    getBody: (data) => `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #1e3a5f; color: white; font-weight: 700; padding: 12px 20px; border-radius: 12px; font-size: 18px;">DDS</div>
        </div>
        <h2 style="color: #1e3a5f; font-size: 22px; margin-bottom: 8px;">Stage 2 is Unlocked! 🔓</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
          Hi <strong>${data.name || 'Student'}</strong>,
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
          You passed Stage 1 with a score of <strong>${data.stage1Score}/100</strong>. You can now take the Aptitude Test.
        </p>
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="color: #3730a3; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">Test Details:</p>
          <p style="color: #4338ca; font-size: 13px; margin: 0; line-height: 1.8;">
            📝 15 questions (Physics, Chemistry, Maths, English, Reasoning)<br>
            ⏱ Timed & AI-proctored<br>
            🎯 Pass mark: 60%<br>
            🔄 2 attempts available
          </p>
        </div>
        <a href="${data.dashboardUrl || '#'}" style="display: block; text-align: center; background: #1e3a5f; color: white; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 24px;">
          Start Aptitude Test →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          DDS University Admissions · Powered by Aria AI
        </p>
      </div>
    `,
  },

  interview_scored: {
    subject: 'Interview Results — DDS University',
    getBody: (data) => `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #1e3a5f; color: white; font-weight: 700; padding: 12px 20px; border-radius: 12px; font-size: 18px;">DDS</div>
        </div>
        <h2 style="color: #1e3a5f; font-size: 22px; margin-bottom: 8px;">Interview Complete 🎤</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
          Hi <strong>${data.name || 'Student'}</strong>,
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
          Your Stage 3 AI Interview with Dr. Mehta has been evaluated. The admissions committee is now reviewing your complete profile.
        </p>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="color: #92400e; font-size: 14px; margin: 0;">
            📧 A decision will be communicated within <strong>7 working days</strong>. Check your dashboard for updates.
          </p>
        </div>
        <a href="${data.dashboardUrl || '#'}" style="display: block; text-align: center; background: #1e3a5f; color: white; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 24px;">
          View Dashboard →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          DDS University Admissions · Powered by Aria AI
        </p>
      </div>
    `,
  },

  final_decision: {
    subject: (data) => data.selected ? '🎉 Congratulations! You\'re Selected — DDS University' : 'Admissions Decision — DDS University',
    getBody: (data) => `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #1e3a5f; color: white; font-weight: 700; padding: 12px 20px; border-radius: 12px; font-size: 18px;">DDS</div>
        </div>
        ${data.selected 
          ? `<h2 style="color: #16a34a; font-size: 24px; margin-bottom: 8px;">🎉 You've Been Selected!</h2>
             <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
               Dear <strong>${data.name || 'Student'}</strong>,
             </p>
             <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
               We are delighted to inform you that you have been <strong>selected for admission</strong> 
               to <strong>${data.branch || 'Engineering'}</strong> at DDS University!
             </p>
             <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0;">
               <p style="color: #166534; font-size: 14px; margin: 0;">
                 Check your dashboard for next steps including document submission and fee payment.
               </p>
             </div>`
          : `<h2 style="color: #1e3a5f; font-size: 22px; margin-bottom: 8px;">Admissions Decision</h2>
             <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
               Dear <strong>${data.name || 'Student'}</strong>,
             </p>
             <p style="color: #4b5563; font-size: 15px; line-height: 1.7;">
               After careful review, we regret to inform you that your application was not successful this cycle.
               We appreciate your effort and encourage you to apply again in the next admissions cycle.
             </p>`
        }
        <a href="${data.dashboardUrl || '#'}" style="display: block; text-align: center; background: #1e3a5f; color: white; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 24px;">
          View Dashboard →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          DDS University Admissions · Powered by Aria AI
        </p>
      </div>
    `,
  },
};

/**
 * Send a notification email via Supabase Edge Function.
 * Fails silently if the edge function is not deployed — emails are non-blocking.
 *
 * @param {'application_submitted'|'stage1_scored'|'stage2_unlocked'|'interview_scored'|'final_decision'} templateId
 * @param {string} toEmail - Recipient email
 * @param {object} data - Template data (name, score, branch, etc.)
 */
export async function sendNotification(templateId, toEmail, data = {}) {
  const template = TEMPLATES[templateId];
  if (!template || !toEmail) {
    console.warn(`[Notifications] Invalid template "${templateId}" or missing email`);
    return;
  }

  const subject = typeof template.subject === 'function' ? template.subject(data) : template.subject;
  const html = template.getBody({ ...data, dashboardUrl: window.location.origin + '/dashboard' });

  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { to: toEmail, subject, html },
    });

    if (error) {
      console.warn(`[Notifications] Edge function error:`, error.message);
      return;
    }

    console.log(`[Notifications] ✅ Sent "${templateId}" to ${toEmail}`);
  } catch (err) {
    // Silently fail — email is non-critical
    console.warn(`[Notifications] Failed to send "${templateId}":`, err.message);
  }
}

export default sendNotification;
