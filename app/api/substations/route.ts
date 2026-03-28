import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';

type SubstationStatus = 'stable' | 'warning' | 'critical';
type DbSubstationStatus = 'STABLE' | 'WARNING' | 'CRITICAL';

const fromDbStatus = (value: string): SubstationStatus => {
	if (value === 'WARNING') return 'warning';
	if (value === 'CRITICAL') return 'critical';
	return 'stable';
};

const toDbStatus = (value: SubstationStatus): DbSubstationStatus => {
	if (value === 'warning') return 'WARNING';
	if (value === 'critical') return 'CRITICAL';
	return 'STABLE';
};

const mapSubstationRow = (row: any) => ({
	id: String(row.id),
	name: String(row.name),
	state: String(row.state),
	location: String(row.location),
	lat: Number(row.lat),
	lon: Number(row.lon),
	currentLoadMW: Number(row.current_load_mw),
	maxCapacityMW: Number(row.max_capacity_mw),
	voltage: Number(row.voltage),
	status: fromDbStatus(String(row.status || 'STABLE')),
	createdAt: row.created_at,
	updatedAt: row.updated_at
});

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const state = searchParams.get('state');

		let rows;
		if (state) {
			rows = await sql`
				SELECT
					id,
					name,
					state,
					location,
					lat,
					lon,
					current_load_mw,
					max_capacity_mw,
					voltage,
					status,
					created_at,
					updated_at
				FROM substations
				WHERE state = ${state}
				ORDER BY name ASC
			`;
		} else {
			rows = await sql`
				SELECT
					id,
					name,
					state,
					location,
					lat,
					lon,
					current_load_mw,
					max_capacity_mw,
					voltage,
					status,
					created_at,
					updated_at
				FROM substations
				ORDER BY name ASC
			`;
		}

		return NextResponse.json({ data: rows.map(mapSubstationRow) });
	} catch (error) {
		console.error('Failed to fetch substations:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch substations' },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const name = String(body.name || '').trim();
		const state = String(body.state || '').trim();
		const location = String(body.location || '').trim();
		const lat = Number(body.lat);
		const lon = Number(body.lon);
		const currentLoadMw = Number(body.currentLoadMw);
		const maxCapacityMw = Number(body.maxCapacityMw);
		const voltage = Number(body.voltage);
		const status = String(body.status || 'stable').toLowerCase() as SubstationStatus;

		// Validation
		if (!name || !state || !location) {
			return NextResponse.json(
				{ error: 'name, state, and location are required' },
				{ status: 400 }
			);
		}

		if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
			return NextResponse.json(
				{ error: 'Invalid latitude or longitude' },
				{ status: 400 }
			);
		}

		if (isNaN(currentLoadMw) || isNaN(maxCapacityMw) || isNaN(voltage)) {
			return NextResponse.json(
				{ error: 'currentLoadMw, maxCapacityMw, and voltage must be numbers' },
				{ status: 400 }
			);
		}

		if (!['stable', 'warning', 'critical'].includes(status)) {
			return NextResponse.json(
				{ error: 'status must be one of: stable, warning, critical' },
				{ status: 400 }
			);
		}

		const id = `sub-${crypto.randomUUID()}`;
		const dbStatus = toDbStatus(status);

		const [created] = await sql`
			INSERT INTO substations (
				id,
				name,
				state,
				location,
				lat,
				lon,
				current_load_mw,
				max_capacity_mw,
				voltage,
				status
			)
			VALUES (
				${id},
				${name},
				${state},
				${location},
				${lat},
				${lon},
				${currentLoadMw},
				${maxCapacityMw},
				${voltage},
				${dbStatus}
			)
			RETURNING *
		`;

		return NextResponse.json({ data: mapSubstationRow(created) }, { status: 201 });
	} catch (error) {
		console.error('Failed to create substation:', error);
		return NextResponse.json(
			{ error: 'Failed to create substation' },
			{ status: 500 }
		);
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const body = await request.json();
		const id = String(body.id || '').trim();
		const status = body.status ? String(body.status).toLowerCase() as SubstationStatus : undefined;
		const currentLoadMw = body.currentLoadMw !== undefined ? Number(body.currentLoadMw) : undefined;

		if (!id) {
			return NextResponse.json(
				{ error: 'id is required' },
				{ status: 400 }
			);
		}

		if (status && !['stable', 'warning', 'critical'].includes(status)) {
			return NextResponse.json(
				{ error: 'status must be one of: stable, warning, critical' },
				{ status: 400 }
			);
		}

		const updates: string[] = [];
		const params: any[] = [];

		if (status !== undefined) {
			updates.push(`status = $${params.length + 1}`);
			params.push(toDbStatus(status));
		}

		if (currentLoadMw !== undefined && !isNaN(currentLoadMw)) {
			updates.push(`current_load_mw = $${params.length + 1}`);
			params.push(currentLoadMw);
		}

		if (updates.length === 0) {
			return NextResponse.json(
				{ error: 'No fields to update' },
				{ status: 400 }
			);
		}

		updates.push(`updated_at = NOW()`);

		const query = `
			UPDATE substations
			SET ${updates.join(', ')}
			WHERE id = $${params.length + 1}
			RETURNING *
		`;

		params.push(id);

		const [updated] = await sql.query(query, params);

		if (!updated) {
			return NextResponse.json(
				{ error: 'Substation not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json({ data: mapSubstationRow(updated) });
	} catch (error) {
		console.error('Failed to update substation:', error);
		return NextResponse.json(
			{ error: 'Failed to update substation' },
			{ status: 500 }
		);
	}
}
