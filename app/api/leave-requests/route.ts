import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';

type LeaveStatus = 'pending' | 'approved' | 'rejected';
type DbLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const isValidStatus = (value: string): value is LeaveStatus => {
	return value === 'pending' || value === 'approved' || value === 'rejected';
};

const toDbStatus = (value: LeaveStatus): DbLeaveStatus => {
	if (value === 'pending') return 'PENDING';
	if (value === 'approved') return 'APPROVED';
	return 'REJECTED';
};

const fromDbStatus = (value: string): LeaveStatus => {
	if (value === 'APPROVED') return 'approved';
	if (value === 'REJECTED') return 'rejected';
	return 'pending';
};

const mapLeaveRow = (row: any) => ({
	...row,
	status: fromDbStatus(String(row.status || 'PENDING'))
});

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const badgeId = searchParams.get('badgeId');

		if (!badgeId) {
			return NextResponse.json(
				{ error: 'badgeId parameter is required' },
				{ status: 400 }
			);
		}

		// First, get the engineer's email from badge ID
		const engineerResult = await sql`
			SELECT id, email FROM engineers WHERE badge_id = ${badgeId}
		`;

		if (engineerResult.length === 0) {
			return NextResponse.json(
				{ error: 'Engineer not found' },
				{ status: 404 }
			);
		}

		const engineerEmail = engineerResult[0].email;

		const rows = await sql`
				SELECT
					id,
					engineer_email,
					start_date,
					end_date,
					reason,
					status,
					submitted_at,
					reviewed_at,
					reviewed_by_id
				FROM leave_requests
				WHERE engineer_email = ${engineerEmail}
				ORDER BY submitted_at DESC
			`;

		return NextResponse.json({ data: rows.map(mapLeaveRow) });
	} catch (error) {
		console.error('Failed to fetch leave requests:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch leave requests' },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const badgeId = String(body.badgeId || '').trim();
		const engineerName = String(body.engineerName || '').trim();
		const startDate = String(body.startDate || '').trim();
		const endDate = String(body.endDate || '').trim();
		const reason = String(body.reason || '').trim();

		if (!badgeId || !startDate || !endDate || !reason) {
			return NextResponse.json(
				{ error: 'badgeId, startDate, endDate, and reason are required' },
				{ status: 400 }
			);
		}

		// Get engineer email from badge ID
		const engineerResult = await sql`
			SELECT id, email FROM engineers WHERE badge_id = ${badgeId}
		`;

		if (engineerResult.length === 0) {
			return NextResponse.json(
				{ error: 'Engineer not found' },
				{ status: 404 }
			);
		}

		const engineerEmail = engineerResult[0].email;
		const id = `lv-${crypto.randomUUID()}`;

		const [created] = await sql`
			INSERT INTO leave_requests (
				id,
				engineer_email,
				start_date,
				end_date,
				reason,
				status
			)
			VALUES (
				${id},
				${engineerEmail},
				${startDate}::timestamptz,
				${endDate}::timestamptz,
				${reason},
				${toDbStatus('pending')}
			)
			RETURNING
				id,
				engineer_email,
				start_date,
				end_date,
				reason,
				status,
				submitted_at,
				reviewed_at,
				reviewed_by_id
		`;

		return NextResponse.json({ data: mapLeaveRow(created) }, { status: 201 });
	} catch (error) {
		console.error('Failed to create leave request:', error);
		return NextResponse.json(
			{ error: 'Failed to create leave request' },
			{ status: 500 }
		);
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const body = await request.json();
		const id = String(body.id || '').trim();
		const status = String(body.status || '').trim().toLowerCase();
		const reviewedById = String(body.reviewedById || '').trim();

		if (!id || !isValidStatus(status) || status === 'pending') {
			return NextResponse.json(
				{ error: 'Valid id and final status (approved/rejected) are required' },
				{ status: 400 }
			);
		}

		const reviewerIdValue = reviewedById || null;

		const [updated] = await sql`
			UPDATE leave_requests
			SET
				status = ${toDbStatus(status)},
				reviewed_at = NOW(),
				reviewed_by_id = (
					SELECT id
					FROM users
					WHERE id = ${reviewerIdValue}
					LIMIT 1
				)
			WHERE id = ${id}
			RETURNING
				id,
				engineer_email,
				start_date,
				end_date,
				reason,
				status,
				submitted_at,
				reviewed_at,
				reviewed_by_id
		`;

		if (!updated) {
			return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
		}

		return NextResponse.json({ data: mapLeaveRow(updated) });
	} catch (error) {
		console.error('Failed to update leave request:', error);
		return NextResponse.json(
			{ error: 'Failed to update leave request' },
			{ status: 500 }
		);
	}
}
