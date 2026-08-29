import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, projectPhases, tasks, assets } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const phases = await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId))
      .orderBy(asc(projectPhases.orderIndex), asc(projectPhases.startDate));

    const scopedTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.position), desc(tasks.createdAt));

    const scopedAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.projectId, projectId))
      .orderBy(desc(assets.createdAt));

    return NextResponse.json({
      success: true,
      project,
      phases,
      tasks: scopedTasks,
      assets: scopedAssets,
    });
  } catch (err: any) {
    console.error("[PROJECT_GET]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.startDate !== undefined) updateData.startDate = body.startDate || null;
    if (body.targetDate !== undefined) updateData.targetDate = body.targetDate || null;
    if (body.isHub !== undefined) updateData.isHub = body.isHub;

    await db.update(projects).set(updateData as any).where(eq(projects.id, projectId));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PROJECT_PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    await db.delete(projects).where(eq(projects.id, projectId));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PROJECT_DELETE]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
