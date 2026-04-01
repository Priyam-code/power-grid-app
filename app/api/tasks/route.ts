import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';

export async function GET(request: NextRequest) {
  try {
    // Grab the badgeId from the URL (e.g., /api/tasks?badgeId=ENG-123)
    const { searchParams } = new URL(request.url);
    const badgeId = searchParams.get('badgeId');

    if (!badgeId) {
      return NextResponse.json({ success: false, error: 'Badge ID is required' }, { status: 400 });
    }

    // Fetch this specific engineer's tasks
    const tasks = await sql`
      SELECT id, location, description, severity, status, created_at, substation
      FROM engineer_tasks
      WHERE engineer_badge_id = ${badgeId}
      ORDER BY 
        CASE WHEN status = 'PENDING' THEN 1 ELSE 2 END,
        created_at DESC
    `;

    return NextResponse.json({ success: true, data: tasks });
  } catch (err) {
    console.error('Fetch error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}