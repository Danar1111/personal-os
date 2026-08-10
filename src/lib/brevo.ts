import { BrevoClient } from "@getbrevo/brevo";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";

export interface SendEmailOptions {
  to: string;
  name?: string;
  subject: string;
  htmlContent: string;
  params?: Record<string, any>;
}

/**
 * Utility to send transactional email via Brevo SMTP API using official @getbrevo/brevo SDK (v6 BrevoClient)
 */
export async function sendBrevoEmail(
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; message: string }> {
  try {
    const toEmail = options.to.trim();
    if (!toEmail || !toEmail.includes("@")) {
      return { success: false, message: "Invalid recipient email address." };
    }

    // 1. Fetch Brevo API Key & Sender configuration from systemSettings DB
    let apiKey = process.env.BREVO_API_KEY || "";
    let senderEmail = "assistant@danar.site";
    let senderName = "Personal OS Assistant";

    try {
      const settings = await db.select().from(systemSettings);
      for (const item of settings) {
        if (item.key === "brevo_api_key" && item.value?.trim()) {
          apiKey = item.value.trim();
        }
        if (item.key === "brevo_sender_email" && item.value?.trim()) {
          senderEmail = item.value.trim();
        }
        if (item.key === "brevo_sender_name" && item.value?.trim()) {
          senderName = item.value.trim();
        }
      }
    } catch (dbErr) {
      console.warn("[BREVO] Failed to load DB settings, using env defaults:", dbErr);
    }

    if (!apiKey) {
      return {
        success: false,
        message: "Brevo API Key is missing. Please configure your Brevo API Key in System Settings (/settings).",
      };
    }

    // 2. Initialize official BrevoClient
    const client = new BrevoClient({ apiKey });

    // 3. Dispatch transactional email via Brevo transactionalEmails API resource
    const response = await client.transactionalEmails.sendTransacEmail({
      htmlContent: options.htmlContent,
      sender: {
        name: senderName,
        email: senderEmail,
      },
      subject: options.subject,
      to: [
        {
          email: toEmail,
          name: options.name || toEmail.split("@")[0],
        },
      ],
      params: options.params,
    });

    const messageId = (response as any)?.messageId || (response as any)?.messageIds?.[0] || "sent";

    return {
      success: true,
      messageId,
      message: `✓ Email successfully sent to ${toEmail} via Brevo SMTP API!`,
    };
  } catch (error: any) {
    console.error("[BREVO] Send email error:", error);
    const errBody =
      error?.response?.body?.message ||
      error?.body?.message ||
      error?.message ||
      "Failed to send email via Brevo.";
    return {
      success: false,
      message: `Failed to send email: ${errBody}`,
    };
  }
}

/**
 * Interpolates Handlebars-style {{variable}} placeholders in HTML string
 */
export function interpolateHandlebars(
  templateStr: string,
  variables: Record<string, any>
): string {
  if (!templateStr) return "";
  let result = templateStr;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, String(value ?? ""));
  }
  return result;
}
