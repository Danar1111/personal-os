"use server";

import { db } from "@/db";
import { emailTemplates, systemSettings, EmailTemplate } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendBrevoEmail, interpolateHandlebars } from "@/lib/brevo";

/**
 * Extracts handlebars {{var_name}} parameters from subject and bodyHtml
 */
function extractHandlebarsVariables(subject: string, bodyHtml: string): string[] {
  const combined = `${subject} ${bodyHtml}`;
  const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const vars = new Set<string>();
  let match;
  while ((match = regex.exec(combined)) !== null) {
    if (match[1]) {
      vars.add(match[1].trim());
    }
  }
  return Array.from(vars);
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  try {
    const templates = await db
      .select()
      .from(emailTemplates)
      .orderBy(desc(emailTemplates.createdAt));
    return templates;
  } catch (error) {
    console.error("[EMAIL_TEMPLATES] Fetch error:", error);
    return [];
  }
}

export async function createEmailTemplate(data: {
  name: string;
  subject: string;
  bodyHtml: string;
}): Promise<{ success: boolean; message?: string; template?: EmailTemplate }> {
  try {
    const name = data.name.trim();
    const subject = data.subject.trim();
    const bodyHtml = data.bodyHtml.trim();

    if (!name) return { success: false, message: "Template Name is required." };
    if (!subject) return { success: false, message: "Subject is required." };
    if (!bodyHtml) return { success: false, message: "Email Body HTML is required." };

    const detectedVars = extractHandlebarsVariables(subject, bodyHtml);
    const id = crypto.randomUUID();

    await db.insert(emailTemplates).values({
      id,
      name,
      subject,
      bodyHtml,
      variables: JSON.stringify(detectedVars),
    });

    revalidatePath("/emailer");
    revalidatePath("/emailer/templates");

    return {
      success: true,
      message: `✓ Created email template "${name}".`,
    };
  } catch (error: any) {
    console.error("[EMAIL_TEMPLATES] Create error:", error);
    return { success: false, message: error.message || "Failed to create template." };
  }
}

export async function updateEmailTemplate(
  id: string,
  data: {
    name?: string;
    subject?: string;
    bodyHtml?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!id) return { success: false, message: "Template ID is required." };

    const updatePayload: Partial<EmailTemplate> = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.subject !== undefined) updatePayload.subject = data.subject.trim();
    if (data.bodyHtml !== undefined) updatePayload.bodyHtml = data.bodyHtml.trim();

    const existing = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id));

    if (existing.length === 0) {
      return { success: false, message: "Template not found." };
    }

    const currentSub = data.subject !== undefined ? data.subject : existing[0].subject;
    const currentBody = data.bodyHtml !== undefined ? data.bodyHtml : existing[0].bodyHtml;
    const detectedVars = extractHandlebarsVariables(currentSub, currentBody);
    updatePayload.variables = JSON.stringify(detectedVars);

    await db
      .update(emailTemplates)
      .set(updatePayload)
      .where(eq(emailTemplates.id, id));

    revalidatePath("/emailer");
    revalidatePath("/emailer/templates");

    return { success: true, message: "✓ Email template updated." };
  } catch (error: any) {
    console.error("[EMAIL_TEMPLATES] Update error:", error);
    return { success: false, message: error.message || "Failed to update template." };
  }
}

export async function deleteEmailTemplate(
  id: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!id) return { success: false, message: "Template ID is required." };

    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));

    revalidatePath("/emailer");
    revalidatePath("/emailer/templates");

    return { success: true, message: "🗑️ Email template deleted." };
  } catch (error: any) {
    console.error("[EMAIL_TEMPLATES] Delete error:", error);
    return { success: false, message: error.message || "Failed to delete template." };
  }
}

export async function sendDirectEmailAction(data: {
  to: string;
  name?: string;
  subject: string;
  bodyHtml: string;
  variables?: Record<string, any>;
}): Promise<{ success: boolean; message: string }> {
  let finalSubject = data.subject;
  let finalBody = data.bodyHtml;

  if (data.variables && Object.keys(data.variables).length > 0) {
    finalSubject = interpolateHandlebars(data.subject, data.variables);
    finalBody = interpolateHandlebars(data.bodyHtml, data.variables);
  }

  return await sendBrevoEmail({
    to: data.to,
    name: data.name,
    subject: finalSubject,
    htmlContent: finalBody,
  });
}

export async function getBrevoSettingsAction(): Promise<{
  apiKey: string;
  senderEmail: string;
  senderName: string;
}> {
  try {
    const settings = await db.select().from(systemSettings);
    let apiKey = "";
    let senderEmail = "assistant@danar.site";
    let senderName = "Personal OS Assistant";

    for (const item of settings) {
      if (item.key === "brevo_api_key") apiKey = item.value || "";
      if (item.key === "brevo_sender_email") senderEmail = item.value || "assistant@danar.site";
      if (item.key === "brevo_sender_name") senderName = item.value || "Personal OS Assistant";
    }

    return { apiKey, senderEmail, senderName };
  } catch (error) {
    console.error("[getBrevoSettingsAction error]:", error);
    return {
      apiKey: "",
      senderEmail: "assistant@danar.site",
      senderName: "Personal OS Assistant",
    };
  }
}

export async function saveBrevoSettingsAction(data: {
  apiKey?: string;
  senderEmail?: string;
  senderName?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const existing = await db.select().from(systemSettings);
    const map = new Map(existing.map((s) => [s.key, s]));

    const saveKey = async (key: string, val: string, isSecret = false) => {
      const prev = map.get(key);
      if (!prev) {
        await db.insert(systemSettings).values({
          key,
          value: val,
          isSecret,
        });
      } else {
        await db
          .update(systemSettings)
          .set({ value: val, isSecret })
          .where(eq(systemSettings.id, prev.id));
      }
    };

    if (data.apiKey !== undefined) {
      await saveKey("brevo_api_key", data.apiKey.trim(), true);
    }
    if (data.senderEmail !== undefined) {
      await saveKey("brevo_sender_email", data.senderEmail.trim(), false);
    }
    if (data.senderName !== undefined) {
      await saveKey("brevo_sender_name", data.senderName.trim(), false);
    }

    revalidatePath("/settings");
    revalidatePath("/emailer");

    return { success: true, message: "✓ Brevo email settings updated successfully." };
  } catch (error: any) {
    console.error("[saveBrevoSettingsAction error]:", error);
    return { success: false, message: error.message || "Failed to save Brevo settings." };
  }
}
