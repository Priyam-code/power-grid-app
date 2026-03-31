import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';

export async function POST(request: NextRequest) {
  try {
    const { badgeId, credential, region } = await request.json();

    if (!badgeId || !credential || !region) {
      return NextResponse.json(
        { success: false, error: 'Badge ID, credential, and region are required' },
        { status: 400 }
      );
    }

    // Query engineer from database
    const result = await sql`
      SELECT id, name, email, badge_id, region, created_at
      FROM engineers
      WHERE badge_id = ${badgeId} AND credential = ${credential} AND region = ${region}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials or region' },
        { status: 401 }
      );
    }

    const engineer = result[0];

    return NextResponse.json({
      success: true,
      data: {
        id: String(engineer.id),
        name: String(engineer.name),
        email: String(engineer.email),
        badgeId: String(engineer.badge_id),
        region: String(engineer.region),
        createdAt: engineer.created_at
      },
      message: 'Login successful'
    });
  } catch (err) {
    console.error('Error during engineer login:', err);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
