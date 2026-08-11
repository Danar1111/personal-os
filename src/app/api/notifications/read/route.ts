import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq } from 'drizzle-orm';

// PATCH /api/notifications/read - Mark notification(s) as read
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, all } = body;

    if (all) {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Notification ID or "all: true" is required' },
        { status: 400 }
      );
    }

    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));

    return NextResponse.json({
      success: true,
      message: `Notification ${id} marked as read`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to update notification: ${error.message}` },
      { status: 500 }
    );
  }
}
