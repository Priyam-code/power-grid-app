import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';

type LeaveStatus = 'pending' | 'approved' | 'rejected';
type DbLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// --- HELPERS (Must be at the top) ---

const toDbStatus = (value: LeaveStatus): DbLeaveStatus => {
    if (value === 'pending') return 'PENDING';
    if (value === 'approved') return 'APPROVED';
    return 'REJECTED';
};

const fromDbStatus = (value: string): LeaveStatus => {
    const upper = String(value || 'PENDING').toUpperCase();
    if (upper === 'APPROVED') return 'approved';
    if (upper === 'REJECTED') return 'rejected';
    return 'pending';
};

const mapLeaveRow = (row: any) => ({
    ...row,
    // Convert DB's "PENDING" to UI's "pending"
    status: fromDbStatus(row.status),
    // Ensure dates are strings for the frontend
    start_date: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : null,
    end_date: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : null,
});

// --- API METHODS ---

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const badgeId = searchParams.get('badgeId');

        let rows;

        if (badgeId) {
            // Engineer View: Get specific person's leave
            const engineerResult = await sql`
                SELECT email FROM engineers WHERE badge_id = ${badgeId}
            `;

            if (engineerResult.length === 0) {
                return NextResponse.json({ error: 'Engineer not found' }, { status: 404 });
            }

            rows = await sql`
                SELECT id, engineer_email, start_date, end_date, reason, status, submitted_at
                FROM leave_requests
                WHERE engineer_email = ${engineerResult[0].email}
                ORDER BY submitted_at DESC
            `;
        } else {
            // Manager View: Get ALL leave requests + Engineer Names
            rows = await sql`
                SELECT 
                    lr.id, 
                    lr.engineer_email, 
                    e.name as engineer_name, 
                    lr.start_date, 
                    lr.end_date, 
                    lr.reason, 
                    lr.status, 
                    lr.submitted_at
                FROM leave_requests lr
                LEFT JOIN engineers e ON lr.engineer_email = e.email
                ORDER BY lr.submitted_at DESC
            `;
        }

        return NextResponse.json({ data: rows.map(mapLeaveRow) });
    } catch (error) {
        console.error('Leave GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status } = body;

        const [updated] = await sql`
            UPDATE leave_requests
            SET status = ${toDbStatus(status as LeaveStatus)},
                reviewed_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `;

        return NextResponse.json({ data: mapLeaveRow(updated) });
    } catch (error) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}