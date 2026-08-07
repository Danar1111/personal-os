import React from "react";
import { getApplications } from "./actions";
import { AppLauncherClient } from "./app-launcher-client";

export const metadata = {
  title: "App Launcher & Hub | Personal OS",
  description: "Centralized application manager, launchpad, and shortcuts for Personal OS",
};

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const initialApps = await getApplications();
  return <AppLauncherClient initialApps={initialApps} />;
}
