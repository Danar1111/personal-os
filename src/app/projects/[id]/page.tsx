import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectDetailAction } from "../actions";
import { ProjectHub } from "@/components/project-hub";
import { Target, ArrowLeft } from "lucide-react";

export const revalidate = 0;
export const dynamic = "force-dynamic";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
  const projectId = parseInt(id, 10);

  if (isNaN(projectId)) notFound();

  const result = await getProjectDetailAction(projectId);

  if (!result.success || !result.project) notFound();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Main Hub */}
      <ProjectHub
        project={result.project}
        initialPhases={result.phases ?? []}
        initialTasks={result.tasks ?? []}
        initialAssets={result.assets ?? []}
        allProjects={result.allProjects ?? []}
        allAssets={result.allAssets ?? []}
        allNotes={result.allNotes ?? []}
      />
    </div>
  );
}
