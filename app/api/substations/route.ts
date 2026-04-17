import { NextRequest, NextResponse } from 'next/server';
import sql, { getDbErrorDetails, isTransientDbError, queryWithRetry } from '@/db/db';

export const runtime = 'nodejs';

type SubstationStatus = 'stable' | 'warning' | 'critical';
type DbSubstationStatus = 'STABLE' | 'WARNING' | 'CRITICAL';

let hasWalletAddressColumnCache: boolean | null = null;

const toBooleanLike = (value: unknown): boolean => value === true || value === 't' || value === '1' || value === 1;

const hasWalletAddressColumn = async (): Promise<boolean> => {
    if (hasWalletAddressColumnCache !== null) {
        return hasWalletAddressColumnCache;
    }

    try {
        const rows = await queryWithRetry(() => sql`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'substations'
                  AND column_name = 'wallet_address'
            ) AS exists
        `);

        hasWalletAddressColumnCache = toBooleanLike(rows[0]?.exists);
        return hasWalletAddressColumnCache;
    } catch {
        hasWalletAddressColumnCache = false;
        return hasWalletAddressColumnCache;
    }
};

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
    walletAddress: row.wallet_address ? String(row.wallet_address) : null,
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
        const includeWalletAddress = await hasWalletAddressColumn();

        let rows;
        if (state) {
            if (includeWalletAddress) {
                rows = await queryWithRetry(() => sql`
                    SELECT
                        id,
                        name,
                        wallet_address,
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
                `);
            } else {
                rows = await queryWithRetry(() => sql`
                    SELECT
                        id,
                        name,
                        NULL::text AS wallet_address,
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
                `);
            }
        } else {
            if (includeWalletAddress) {
                rows = await queryWithRetry(() => sql`
                    SELECT
                        id,
                        name,
                        wallet_address,
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
                `);
            } else {
                rows = await queryWithRetry(() => sql`
                    SELECT
                        id,
                        name,
                        NULL::text AS wallet_address,
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
                `);
            }
        }

        return NextResponse.json({ data: rows.map(mapSubstationRow) });
    } catch (error) {
        console.error('Failed to fetch substations:', error);
        const status = isTransientDbError(error) ? 503 : 500;
        return NextResponse.json(
            {
                error: 'Failed to fetch substations',
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
        const name = String(body.name || '').trim();
        const state = String(body.state || '').trim();
        const location = String(body.location || '').trim();
        const lat = Number(body.lat);
        const lon = Number(body.lon);
        const currentLoadMw = Number(body.currentLoadMw);
        const maxCapacityMw = Number(body.maxCapacityMw);
        const voltage = Number(body.voltage);
        const status = String(body.status || 'stable').toLowerCase() as SubstationStatus;
        
        // Fix: Extracting the new credentials
        const station_id = String(body.station_id || '').trim();
        const passcode = String(body.passcode || '').trim();
        const walletAddress = String(body.walletAddress || '').trim();

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
        const includeWalletAddress = await hasWalletAddressColumn();

        const [created] = includeWalletAddress
            ? await queryWithRetry(() => sql`
                INSERT INTO substations (
                    id,
                    name,
                    wallet_address,
                    state,
                    location,
                    lat,
                    lon,
                    current_load_mw,
                    max_capacity_mw,
                    voltage,
                    status,
                    station_id,
                    passcode
                )
                VALUES (
                    ${id},
                    ${name},
                    ${walletAddress || null},
                    ${state},
                    ${location},
                    ${lat},
                    ${lon},
                    ${currentLoadMw},
                    ${maxCapacityMw},
                    ${voltage},
                    ${dbStatus},
                    ${station_id},
                    ${passcode}
                )
                RETURNING *
            `)
            : await queryWithRetry(() => sql`
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
                    status,
                    station_id,
                    passcode
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
                    ${dbStatus},
                    ${station_id},
                    ${passcode}
                )
                RETURNING *
            `);

        return NextResponse.json({ data: mapSubstationRow(created) }, { status: 201 });
    } catch (error) {
        console.error('Failed to create substation:', error);
        const status = isTransientDbError(error) ? 503 : 500;
        return NextResponse.json(
            {
                error: 'Failed to create substation',
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
        const id = String(body.id || '').trim();
        const status = body.status ? String(body.status).toLowerCase() as SubstationStatus : undefined;
        const currentLoadMw = body.currentLoadMw !== undefined ? Number(body.currentLoadMw) : undefined;
        const maxCapacityMw = body.maxCapacityMw !== undefined ? Number(body.maxCapacityMw) : undefined;

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

        if (maxCapacityMw !== undefined && !isNaN(maxCapacityMw)) {
            updates.push(`max_capacity_mw = $${params.length + 1}`);
            params.push(maxCapacityMw);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        let updated;
        try {
            if (status !== undefined && currentLoadMw !== undefined && maxCapacityMw !== undefined) {
                [updated] = await queryWithRetry(() => sql`
                    UPDATE substations
                    SET status = ${toDbStatus(status)}, current_load_mw = ${currentLoadMw}, max_capacity_mw = ${maxCapacityMw}, updated_at = NOW()
                    WHERE id = ${id}
                    RETURNING *
                `);
            } else if (status !== undefined && currentLoadMw !== undefined) {
                [updated] = await queryWithRetry(() => sql`
                    UPDATE substations
                    SET status = ${toDbStatus(status)}, current_load_mw = ${currentLoadMw}, updated_at = NOW()
                    WHERE id = ${id}
                    RETURNING *
                `);
            } else if (status !== undefined && maxCapacityMw !== undefined) {
                [updated] = await queryWithRetry(() => sql`
                    UPDATE substations
                    SET status = ${toDbStatus(status)}, max_capacity_mw = ${maxCapacityMw}, updated_at = NOW()
                    WHERE id = ${id}
                    RETURNING *
                `);
            } else if (currentLoadMw !== undefined && maxCapacityMw !== undefined) {
                [updated] = await queryWithRetry(() => sql`
                    UPDATE substations
                    SET current_load_mw = ${currentLoadMw}, max_capacity_mw = ${maxCapacityMw}, updated_at = NOW()
                    WHERE id = ${id}
                    RETURNING *
                `);
            } else if (status !== undefined) {
                [updated] = await queryWithRetry(() => sql`
                    UPDATE substations
                    SET status = ${toDbStatus(status)}, updated_at = NOW()
                    WHERE id = ${id}
                    RETURNING *
                `);
            } else if (currentLoadMw !== undefined) {
                [updated] = await queryWithRetry(() => sql`
                    UPDATE substations
                    SET current_load_mw = ${currentLoadMw}, updated_at = NOW()
                    WHERE id = ${id}
                    RETURNING *
                `);
            } else if (maxCapacityMw !== undefined) {
                [updated] = await queryWithRetry(() => sql`
                    UPDATE substations
                    SET max_capacity_mw = ${maxCapacityMw}, updated_at = NOW()
                    WHERE id = ${id}
                    RETURNING *
                `);
            }
        } catch (dbError) {
            console.error('Database update query failed:', dbError);
            throw dbError;
        }

        if (!updated) {
            return NextResponse.json(
                { error: 'Substation not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: mapSubstationRow(updated) });
    } catch (error) {
        console.error('Failed to update substation:', error);
        const status = isTransientDbError(error) ? 503 : 500;
        return NextResponse.json(
            {
                error: 'Failed to update substation',
                details: getDbErrorDetails(error),
                retryable: status === 503,
            },
            { status }
        );
    }
}