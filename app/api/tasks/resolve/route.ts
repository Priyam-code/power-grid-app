// app/api/tasks/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';

export async function PATCH(request: NextRequest) {
    try {
        const { taskId } = await request.json();

        await sql`
            UPDATE engineer_tasks 
            SET status = 'COMPLETED', resolved_at = NOW() 
            WHERE id = ${taskId}
        `;

        return NextResponse.json({ success: true, message: "Task resolved. Location is now clear." });
    } catch (error) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}