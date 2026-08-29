import React from "react";
import { getAllProjectsAction } from "./actions";
import { ProjectsDashboard } from "@/components/projects-dashboard";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { projects, imageAssets } = await getAllProjectsAction();

  return <ProjectsDashboard initialProjects={projects} initialImageAssets={imageAssets} />;
}
