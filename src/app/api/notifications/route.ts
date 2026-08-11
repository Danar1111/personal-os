import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// GET /api/notifications - Fetch latest 20 notifications
export async function GET() {
  try {
    const list = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    return NextResponse.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to fetch notifications: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Create a new notification
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, message, type = 'info' } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, message: 'Title and message are required' },
        { status: 400 }
      );
    }

    const newNotification = {
      id: randomUUID(),
      title,
      message,
      type: ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info',
      isRead: false,
      createdAt: new Date(),
    };

    await db.insert(notifications).values(newNotification);

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully',
      data: newNotification,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to create notification: ${error.message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Clear all notifications from DB
export async function DELETE() {
  try {
    await db.delete(notifications);
    return NextResponse.json({
      success: true,
      message: 'All notifications cleared successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Failed to clear notifications: ${error.message}` },
      { status: 500 }
    );
  }
}

