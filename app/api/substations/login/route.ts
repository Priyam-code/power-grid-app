import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';

type SubstationStatus = 'stable' | 'warning' | 'critical';

const fromDbStatus = (value: string): SubstationStatus => {
    const upper = String(value).toUpperCase();
    if (upper === 'WARNING') return 'warning';
    if (upper === 'CRITICAL') return 'critical';
    return 'stable';
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
    station_id: String(row.station_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        const station_id = String(body.station_id || '').trim();
        const passcode = String(body.passcode || '').trim();

        if (!station_id || !passcode) {
            return NextResponse.json(
                { error: 'station_id and passcode are required' },
                { status: 400 }
            );
        }

        // We cast the result as 'any' to stop TypeScript from 
        // over-analyzing the return type during the production build.
        const result: any = await sql`
            SELECT * FROM substations
            WHERE station_id = ${station_id} 
              AND passcode = ${passcode}
        `;

        // Safe extraction that satisfies the build worker
        const rows = Array.isArray(result) ? result : (result?.rows || []);
        const substation = rows[0];

        if (!substation) {
            return NextResponse.json(
                { error: 'Invalid Station ID or Passcode' },
                { status: 401 }
            );
        }

        return NextResponse.json({ 
            success: true,
            message: 'Login successful',
            data: mapSubstationRow(substation) 
        }, { status: 200 });

    } catch (error) {
        console.error('Failed to login substation:', error);
        return NextResponse.json(
            { error: 'Internal server error during login' },
            { status: 500 }
        );
    }
}