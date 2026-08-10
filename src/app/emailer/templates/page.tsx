import React, { Suspense } from "react";
import { getEmailTemplates, getBrevoSettingsAction } from "../actions";
import { EmailerTemplatesClient } from "./emailer-templates-client";

export const metadata = {
  title: "Omni-Emailer Template Studio | Personal OS",
  description: "Brevo SMTP Transactional Templates & Dynamic Handlebars Variables",
};

export const dynamic = "force-dynamic";

export default async function EmailerTemplatesPage() {
  const initialTemplates = await getEmailTemplates();
  const brevoSettings = await getBrevoSettingsAction();

  return (
    <Suspense fallback={null}>
      <EmailerTemplatesClient
        initialTemplates={initialTemplates}
        brevoConfigured={!!brevoSettings.apiKey?.trim()}
      />
    </Suspense>
  );
}
