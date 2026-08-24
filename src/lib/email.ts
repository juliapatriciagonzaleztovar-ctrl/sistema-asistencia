import nodemailer from "nodemailer";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const config: EmailConfig = {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  };

  if (!config.host || !config.user || !config.pass) {
    console.warn("Email not configured: missing SMTP env vars");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });

  return transporter;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "\u0022")
    .replace(/'/g, "\u0027");
}

export async function sendCorrectionNotification(
  adminEmails: string[],
  childName: string,
  childCode: string,
  date: string,
  reason: string
): Promise<void> {
  const subject = `Nueva solicitud de corrección - ${childName} (${childCode})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Nueva Solicitud de Corrección</h2>
      </div>
      <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p><strong>Niño:</strong> ${escapeHtml(childName)}</p>
        <p><strong>Código:</strong> ${escapeHtml(childCode)}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(date)}</p>
        <p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 14px;">
          Ingresa al sistema para revisar y aprobar/rechazar la solicitud.
        </p>
      </div>
    </div>
  `;
  await sendEmail(adminEmails, subject, html);
}

export async function sendCorrectionResolutionNotification(
  operatorEmail: string,
  childName: string,
  childCode: string,
  date: string,
  approved: boolean,
  adminNote?: string
): Promise<void> {
  const subject = approved
    ? `Corrección APROBADA - ${childName} (${childCode})`
    : `Corrección RECHAZADA - ${childName} (${childCode})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${approved ? "#16a34a" : "#dc2626"}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Corrección ${approved ? "Aprobada" : "Rechazada"}</h2>
      </div>
      <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p><strong>Niño:</strong> ${escapeHtml(childName)}</p>
        <p><strong>Código:</strong> ${escapeHtml(childCode)}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(date)}</p>
        ${adminNote ? `<p><strong>Nota del administrador:</strong> ${escapeHtml(adminNote)}</p>` : ""}
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 14px;">
          ${approved
            ? "La corrección fue aprobada. Ya puedes marcar la asistencia nuevamente."
            : "La corrección fue rechazada. Contacta al administrador si necesitas más información."}
        </p>
      </div>
    </div>
  `;
  await sendEmail(operatorEmail, subject, html);
}

export async function sendAbsenceReport(
  adminEmails: string[],
  date: string,
  absentChildren: { name: string; code: string }[],
  absentStaff: { name: string; role: string }[]
): Promise<void> {
  const subject = `Reporte de ausencias - ${date}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Reporte Diario de Ausencias</h2>
        <p style="margin: 10px 0 0; opacity: 0.9;">${escapeHtml(date)}</p>
      </div>
      <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        ${absentChildren.length > 0 ? `
          <h3 style="color: #dc2626; margin-top: 0;">Niños ausentes (${absentChildren.length})</h3>
          <ul style="padding-left: 20px;">
            ${absentChildren.map((c) => `<li>${escapeHtml(c.name)} (${escapeHtml(c.code)})</li>`).join("")}
          </ul>
        ` : "<p style='color: #16a34a;'>No hay niños ausentes hoy.</p>"}
        
        ${absentStaff.length > 0 ? `
          <h3 style="color: #dc2626; margin-top: 20px;">Personal ausente (${absentStaff.length})</h3>
          <ul style="padding-left: 20px;">
            ${absentStaff.map((s) => `<li>${escapeHtml(s.name)} (${escapeHtml(s.role)})</li>`).join("")}
          </ul>
        ` : "<p style='color: #16a34a;'>No hay personal ausente hoy.</p>"}
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 14px;">
          Reporte generado automáticamente.
        </p>
      </div>
    </div>
  `;
  await sendEmail(adminEmails, subject, html);
}

export async function sendBackupNotification(
  adminEmails: string[],
  success: boolean,
  details?: string
): Promise<void> {
  const subject = success ? "Backup completado exitosamente" : "Error en backup automático";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${success ? "#16a34a" : "#dc2626"}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${success ? "Backup Completado" : "Error en Backup"}</h2>
      </div>
      <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p>${escapeHtml(details || (success ? "El backup automático se completó correctamente." : "Ocurrió un error durante el backup automático."))}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 14px;">Fecha: ${new Date().toLocaleString("es-CO")}</p>
      </div>
    </div>
  `;
  await sendEmail(adminEmails, subject, html);
}

export async function sendAutoMarkNotification(
  adminEmails: string[],
  type: "children" | "staff",
  count: number
): Promise<void> {
  const subject = `Auto-marcaje de ausencias - ${type === "children" ? "Niños" : "Personal"}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Auto-marcaje de Ausencias</h2>
      </div>
      <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p>Se marcaron <strong>${count}</strong> ${type === "children" ? "niños" : "miembros del personal"} como ausentes por auto-cierre.</p>
        <p>Hora: ${new Date().toLocaleString("es-CO")}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 14px;">Proceso automático.</p>
      </div>
    </div>
  `;
  await sendEmail(adminEmails, subject, html);
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}