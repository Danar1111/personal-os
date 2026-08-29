import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, projectPhases, tasks, assets } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.isHub, true))
      .orderBy(desc(projects.createdAt));

    // Attach counts
    const enriched = await Promise.all(
      allProjects.map(async (p) => {
        const [phaseCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(projectPhases)
          .where(eq(projectPhases.projectId, p.id));
        const [taskCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .where(eq(tasks.projectId, p.id));
        return {
          ...p,
          phaseCount: Number(phaseCount?.count ?? 0),
          taskCount: Number(taskCount?.count ?? 0),
        };
      })
    );

    return NextResponse.json({ success: true, projects: enriched });
  } catch (err: any) {
    console.error("[PROJECTS_GET]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, status, startDate, targetDate, isHub } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    await db.insert(projects).values({
      name: name.trim(),
      description: description?.trim() || null,
      status: status || "PLANNING",
      startDate: startDate || null,
      targetDate: targetDate || null,
      isHub: isHub ?? true,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PROJECTS_POST]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
