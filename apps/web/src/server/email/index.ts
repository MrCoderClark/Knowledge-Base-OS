import nodemailer from "nodemailer";
import { env } from "@/server/env";

/**
 * Email abstraction. Currently a nodemailer SMTP transport; swap the transport
 * here (e.g. a provider API) without touching callers.
 */
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE, // true for 465, false for 587 (STARTTLS)
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
});

type Mail = { to: string; subject: string; text: string; html: string };

async function sendMail(mail: Mail): Promise<void> {
  await transporter.sendMail({ from: env.EMAIL_FROM, ...mail });
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#475569;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:24px;">KnowledgeOS</div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:20px;color:#1e293b;">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-top:16px;">If you weren't expecting this email, you can ignore it.</p>
  </div></body></html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">${label}</a>`;
}

export async function sendInviteEmail(params: {
  to: string;
  name?: string | null;
  url: string;
}): Promise<void> {
  const greeting = params.name ? `Hi ${params.name},` : "Hi,";
  await sendMail({
    to: params.to,
    subject: "You've been invited to KnowledgeOS",
    text: `${greeting}\n\nYou've been invited to KnowledgeOS. Set your password to activate your account:\n${params.url}\n\nThis link expires in 72 hours.`,
    html: layout(
      "You've been invited",
      `<p style="margin:0 0 16px;font-size:14px;">${greeting} you've been invited to KnowledgeOS. Set your password to activate your account.</p>
       <p style="margin:0 0 20px;">${button(params.url, "Set your password")}</p>
       <p style="margin:0;font-size:12px;color:#94a3b8;">This link expires in 72 hours.</p>`,
    ),
  });
}

export async function sendCourseAssignedEmail(params: {
  to: string;
  name?: string | null;
  courseTitle: string;
  url: string;
  dueAt?: Date | null;
}): Promise<void> {
  const greeting = params.name ? `Hi ${params.name},` : "Hi,";
  const due = params.dueAt
    ? ` It's due by ${params.dueAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}.`
    : "";
  await sendMail({
    to: params.to,
    subject: `New training assigned: ${params.courseTitle}`,
    text: `${greeting}\n\nYou've been assigned the course "${params.courseTitle}".${due}\n\nStart it here:\n${params.url}`,
    html: layout(
      "New training assigned",
      `<p style="margin:0 0 16px;font-size:14px;">${greeting} you've been assigned the course <strong>${params.courseTitle}</strong>.${due}</p>
       <p style="margin:0 0 20px;">${button(params.url, "Start course")}</p>`,
    ),
  });
}

export async function sendCourseDueReminderEmail(params: {
  to: string;
  name?: string | null;
  courseTitle: string;
  url: string;
  dueAt: Date;
  overdue: boolean;
}): Promise<void> {
  const greeting = params.name ? `Hi ${params.name},` : "Hi,";
  const when = params.dueAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const line = params.overdue
    ? `is <strong>overdue</strong> (was due ${when})`
    : `is due by <strong>${when}</strong>`;
  await sendMail({
    to: params.to,
    subject: params.overdue
      ? `Overdue: ${params.courseTitle}`
      : `Reminder: ${params.courseTitle} is due soon`,
    text: `${greeting}\n\nYour training "${params.courseTitle}" ${
      params.overdue ? `is overdue (was due ${when})` : `is due by ${when}`
    }.\n\nContinue here:\n${params.url}`,
    html: layout(
      params.overdue ? "Training overdue" : "Training due soon",
      `<p style="margin:0 0 16px;font-size:14px;">${greeting} your training <strong>${params.courseTitle}</strong> ${line}.</p>
       <p style="margin:0 0 20px;">${button(params.url, "Continue course")}</p>`,
    ),
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name?: string | null;
  url: string;
}): Promise<void> {
  const greeting = params.name ? `Hi ${params.name},` : "Hi,";
  await sendMail({
    to: params.to,
    subject: "Reset your KnowledgeOS password",
    text: `${greeting}\n\nWe received a request to reset your password. Use the link below (expires in 30 minutes):\n${params.url}\n\nIf you didn't request this, you can ignore this email — your password won't change.`,
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 16px;font-size:14px;">${greeting} we received a request to reset your password.</p>
       <p style="margin:0 0 20px;">${button(params.url, "Reset password")}</p>
       <p style="margin:0;font-size:12px;color:#94a3b8;">This link expires in 30 minutes. If you didn't request it, ignore this email — your password won't change.</p>`,
    ),
  });
}

export async function sendPasswordChangedEmail(params: {
  to: string;
  name?: string | null;
}): Promise<void> {
  const greeting = params.name ? `Hi ${params.name},` : "Hi,";
  await sendMail({
    to: params.to,
    subject: "Your KnowledgeOS password was changed",
    text: `${greeting}\n\nYour password was just changed and all active sessions were signed out. If this wasn't you, contact your administrator immediately.`,
    html: layout(
      "Your password was changed",
      `<p style="margin:0 0 12px;font-size:14px;">${greeting} your password was just changed and all active sessions were signed out.</p>
       <p style="margin:0;font-size:13px;">If this wasn't you, contact your administrator immediately.</p>`,
    ),
  });
}
