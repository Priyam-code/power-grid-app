import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { location, description, severity, state } = body;

        if (!location || !state) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

        const safeSeverity = (severity || 'CRITICAL').toUpperCase();

        // ATOMIC "LEAST BUSY" DISPATCH LOGIC
        // 1. We join engineers with their current pending tasks.
        // 2. We sort by the number of tasks they currently have (ASC).
        // 3. We ensure the location doesn't already have a pending task.
        const result: any = await sql`
            INSERT INTO engineer_tasks (
                id, engineer_badge_id, assignee_email, location, description, severity, status
            )
            SELECT 
                ${`tsk-${crypto.randomUUID()}`}, 
                e.badge_id, 
                e.email, 
                ${location}, 
                ${description}, 
                ${safeSeverity}, 
                'PENDING'
            FROM engineers e
            LEFT JOIN engineer_tasks t ON e.email = t.assignee_email AND t.status = 'PENDING'
            WHERE UPPER(e.region) = UPPER(${state})
              AND NOT EXISTS (
                  SELECT 1 FROM leave_requests l 
                  WHERE l.engineer_email = e.email AND l.status = 'approved' 
                  AND CURRENT_DATE BETWEEN l.start_date AND l.end_date
              )
              AND NOT EXISTS (
                  SELECT 1 FROM engineer_tasks et 
                  WHERE et.location = ${location} AND et.status = 'PENDING'
              )
            GROUP BY e.id, e.badge_id, e.email
            ORDER BY COUNT(t.id) ASC, e.id ASC -- Sort by least busy, then by ID for stable cycling
            LIMIT 1
            RETURNING assignee_email, id
        `;

        const rows = Array.isArray(result) ? result : (result?.rows || []);

        if (rows.length === 0) {
            return NextResponse.json({ 
                success: true, 
                message: 'No available engineers or duplicate location.',
                duplicate: true 
            });
        }

        const assigned = rows[0];

        // Send REAL Gmail Email
        await transporter.sendMail({
            from: `"GridOps Alert" <${process.env.ALERT_FROM_EMAIL}>`,
            to: assigned.assignee_email,
            subject: `🚨 DISPATCH: ${safeSeverity} Alert at ${location}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background: #0a0a0a; color: #fff; border: 1px solid #474747;">
                    <h2 style="color: #ef4444;">NEW ASSIGNMENT</h2>
                    <p>You have been assigned to: <strong>${location}</strong></p>
                    <p><strong>Details:</strong> ${description}</p>
                    <p style="font-size: 11px; color: #888; margin-top: 20px;">RLDC Automated Dispatch System</p>
                </div>
            `
        });

        return NextResponse.json({ 
            success: true, 
            assignedTo: assigned.assignee_email,
            taskId: assigned.id
        });

    } catch (error) {
        console.error('Dispatch Fail:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}