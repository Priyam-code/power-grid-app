import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/db';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function GET(request: NextRequest) {
  try {
    // Grab the badgeId from the URL (e.g., /api/tasks?badgeId=ENG-123)
    const { searchParams } = new URL(request.url);
    const badgeId = searchParams.get('badgeId');

    if (!badgeId) {
      return NextResponse.json({ success: false, error: 'Badge ID is required' }, { status: 400 });
    }

    // Fetch this specific engineer's tasks
    const tasks = await sql`
      SELECT id, location, description, severity, status, created_at, substation_id
      FROM engineer_tasks
      WHERE engineer_badge_id = ${badgeId}
      ORDER BY 
        CASE WHEN status = 'PENDING' THEN 1 ELSE 2 END,
        created_at DESC
    `;

    return NextResponse.json({ success: true, data: tasks });
  } catch (err) {
    console.error('Fetch error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { engineerEmail, location, description, severity, status, badgeId, substationId } = data;

    if (!engineerEmail) {
      return NextResponse.json({ success: false, error: 'Engineer email is required to dispatch tasks' }, { status: 400 });
    }

    const taskId = `tsk-${crypto.randomUUID()}`;
    const safeSeverity = (severity || 'CRITICAL').toUpperCase();

    // Insert task into existing engineer_tasks schema
    await sql`
      INSERT INTO engineer_tasks (
        id, engineer_badge_id, assignee_email, location, description, severity, status, substation_id
      ) VALUES (
        ${taskId}, 
        ${badgeId || null}, 
        ${engineerEmail}, 
        ${location}, 
        ${description}, 
        ${safeSeverity}, 
        ${status || 'PENDING'},
        ${substationId || null}
      )
    `;

    // Attempt to dispatch mail via nodemail
    try {
      await transporter.sendMail({
        from: `"GridOps Dispatch" <${process.env.ALERT_FROM_EMAIL}>`,
        to: engineerEmail,
        subject: `🚨 MANUAL DISPATCH: New ${safeSeverity} Alert at ${location}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #0a0a0a; color: #fff; border: 1px solid #474747;">
             <h2 style="color: #ef4444;">NEW ASSIGNMENT DISPATCHED</h2>
             <p>You have been assigned to handle a new fault at: <strong>${location}</strong></p>
             <p><strong>Description:</strong> ${description}</p>
             <p><strong>Severity:</strong> ${safeSeverity}</p>
          </div>
        `
      });
    } catch (mailError) {
      console.warn('Mail dispatch failed (task handled):', mailError);
    }

    return NextResponse.json({ success: true, taskId });

  } catch (error) {
    console.error('Task creation failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}