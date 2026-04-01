import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';
import nodemailer from 'nodemailer';

// Generate random credential (6 digit PIN)
const generateCredential = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Initialize nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Get engineers
export async function GET(request: NextRequest) {
  try {
    const rows = await sql`
      SELECT id, name, email, badge_id, region, created_at, updated_at
      FROM engineers
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: rows.map(row => ({
        id: String(row.id),
        name: String(row.name),
        email: String(row.email),
        badgeId: String(row.badge_id),
        region: String(row.region),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (err) {
    console.error('Error fetching engineers:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch engineers' },
      { status: 500 }
    );
  }
}

// Add new engineer
export async function POST(request: NextRequest) {
  try {
    const { name, email, region } = await request.json();

    if (!name || !email || !region) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and region are required' },
        { status: 400 }
      );
    }

    // Generate credential and badge ID
    const credential = generateCredential();
    const badgeId = `ENG-${Math.floor(100 + Math.random() * 900)}`;

    // Insert engineer into database
    const result = await sql`
      INSERT INTO engineers (name, email, badge_id, credential, region)
      VALUES (${name}, ${email}, ${badgeId}, ${credential}, ${region})
      RETURNING id, name, email, badge_id, region, created_at, updated_at
    `;

    const engineer = result[0];

    // Send credential via email
    try {
      await transporter.sendMail({
        from: process.env.ALERT_FROM_EMAIL,
        to: email,
        subject: 'Engineer Credentials - Urja Setu',
        html: `
          <h2>Welcome to Urja Setu</h2>
          <p>Hello ${name},</p>
          <p>Your engineer account has been created. Use the credentials below to login:</p>
          <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Badge ID:</strong> ${badgeId}</p>
            <p><strong>Auth PIN:</strong> ${credential}</p>
            <p><strong>Region:</strong> ${region}</p>
          </div>
          <p>Please keep these credentials secure and do not share them with anyone.</p>
          <p>If you have any issues, contact your administrator.</p>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send email:', emailErr);
      // Continue even if email fails - engineer is still created
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(engineer.id),
        name: String(engineer.name),
        email: String(engineer.email),
        badgeId: String(engineer.badge_id),
        region: String(engineer.region),
        createdAt: engineer.created_at,
        updatedAt: engineer.updated_at
      },
      message: 'Engineer created and credentials sent to email'
    });
  } catch (err) {
    console.error('Error creating engineer:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create engineer' },
      { status: 500 }
    );
  }
}
