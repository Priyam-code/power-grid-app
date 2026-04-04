import { NextRequest, NextResponse } from 'next/server';
import sql, { getDbErrorDetails, isTransientDbError, queryWithRetry } from '@/db/db';

export const runtime = 'nodejs';

type LeaveStatus = 'pending' | 'approved' | 'rejected';
type DbLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const CHAIN_LEAVE_PATTERN = /\[chainLeaveId:(\d+)\]\s*$/i;

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

const parseReasonAndChainLeave = (rawReason: string) => {
    const text = String(rawReason || '');
    const match = text.match(CHAIN_LEAVE_PATTERN);
    const chainLeaveId = match ? Number(match[1]) : null;
    const cleanedReason = text.replace(CHAIN_LEAVE_PATTERN, '').trim();

    return {
        reason: cleanedReason || text,
        chainLeaveId,
    };
};

const mapLeaveRow = (row: any) => ({
    ...row,
    ...parseReasonAndChainLeave(String(row.reason || '')),
    status: fromDbStatus(row.status),
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
            const engineerResult = await queryWithRetry(() => sql`
                SELECT email FROM engineers WHERE badge_id = ${badgeId}
            `);

            if (engineerResult.length === 0) {
                return NextResponse.json({ error: 'Engineer not found' }, { status: 404 });
            }

            rows = await queryWithRetry(() => sql`
                SELECT id, engineer_email, start_date, end_date, reason, status, submitted_at
                FROM leave_requests
                WHERE engineer_email = ${engineerResult[0].email}
                ORDER BY submitted_at DESC
            `);
        } else {
            // Manager View: Get ALL leave requests + Engineer Names
            rows = await queryWithRetry(() => sql`
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
            `);
        }

        return NextResponse.json({ data: rows.map(mapLeaveRow) });
    } catch (error) {
        console.error('Leave GET Error:', error);
        const status = isTransientDbError(error) ? 503 : 500;
        return NextResponse.json(
            {
                error: 'Failed to fetch',
                details: getDbErrorDetails(error),
                retryable: status === 503,
            },
            { status }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const badgeId = String(body.badgeId || '').trim();
        const startDate = String(body.startDate || '').trim();
        const endDate = String(body.endDate || '').trim();
        const reason = String(body.reason || '').trim();

        if (!badgeId || !startDate || !endDate || !reason) {
            return NextResponse.json(
                { error: 'badgeId, startDate, endDate and reason are required' },
                { status: 400 }
            );
        }

        const engineer = await queryWithRetry(() => sql`
            SELECT email
            FROM engineers
            WHERE badge_id = ${badgeId}
            LIMIT 1
        `);

        if (!engineer.length) {
            return NextResponse.json(
                { error: 'Engineer not found' },
                { status: 404 }
            );
        }

        const leaveId = `leave-${crypto.randomUUID()}`;

        const [created] = await queryWithRetry(() => sql`
            INSERT INTO leave_requests (
                id,
                engineer_email,
                start_date,
                end_date,
                reason,
                status,
                submitted_at
            )
            VALUES (
                ${leaveId},
                ${engineer[0].email},
                ${startDate},
                ${endDate},
                ${reason},
                ${toDbStatus('pending')},
                NOW()
            )
            RETURNING *
        `);

        return NextResponse.json({ data: mapLeaveRow(created) }, { status: 201 });
    } catch (error) {
        console.error('Leave POST Error:', error);
        const status = isTransientDbError(error) ? 503 : 500;
        return NextResponse.json(
            {
                error: 'Failed to submit leave request',
                details: getDbErrorDetails(error),
                retryable: status === 503,
            },
            { status }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status } = body;

        if (!id || !status || !['approved', 'rejected'].includes(String(status).toLowerCase())) {
            return NextResponse.json({ error: 'Valid id and status are required' }, { status: 400 });
        }

        const [updated] = await queryWithRetry(() => sql`
            UPDATE leave_requests
            SET status = ${toDbStatus(status as LeaveStatus)},
                reviewed_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `);

        if (!updated) {
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        }

        return NextResponse.json({ data: mapLeaveRow(updated) });
    } catch (error) {
        const status = isTransientDbError(error) ? 503 : 500;
        return NextResponse.json(
            {
                error: 'Update failed',
                details: getDbErrorDetails(error),
                retryable: status === 503,
            },
            { status }
        );
    }
}