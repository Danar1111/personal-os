import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projectPhases } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const phaseId = parseInt(id, 10);
    if (isNaN(phaseId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.endDate !== undefined) updateData.endDate = body.endDate;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.orderIndex !== undefined) updateData.orderIndex = body.orderIndex;

    await db.update(projectPhases).set(updateData as any).where(eq(projectPhases.id, phaseId));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PHASE_PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const phaseId = parseInt(id, 10);
    if (isNaN(phaseId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    await db.delete(projectPhases).where(eq(projectPhases.id, phaseId));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PHASE_DELETE]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
