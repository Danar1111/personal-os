import React, { Suspense } from "react";
import { getKnowledgeEntries } from "./actions";
import { KnowledgeClient } from "./knowledge-client";

export const metadata = {
  title: "Personal Knowledge Vault | Personal OS",
  description: "User Preferences, Brand Guidelines & Secure Credentials Vault for Personal OS",
};

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = (await searchParams) || {};
  const initialEntries = await getKnowledgeEntries();

  return (
    <Suspense fallback={null}>
      <KnowledgeClient
        initialEntries={initialEntries}
        initialSearchQuery={search?.trim() || ""}
      />
    </Suspense>
  );
}
