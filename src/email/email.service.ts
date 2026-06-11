import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  async onModuleInit() {
    const port = Number(process.env.SMTP_PORT ?? 587);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await this.transporter.verify();
      this.logger.log(`SMTP OK — ${process.env.SMTP_HOST}:${port}`);
    } catch (err: any) {
      this.logger.error(`SMTP connection failed — ${err.message}`);
      throw new Error(`SMTP verification failed: ${err.message}`);
    }
  }

  private get from() {
    return process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@oasisgym.com';
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to} — subject: "${subject}" — ${err.message}`);
    }
  }

  async sendWelcome(to: string, name: string, tempPassword: string, loginUrl: string) {
    const credentialsSection = tempPassword
      ? `
        <p>Usa las siguientes credenciales para iniciar sesión:</p>
        <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:20px 0">
          <p><strong>Correo electrónico:</strong> ${to}</p>
          <p><strong>Contraseña temporal:</strong> <code style="background:#f0f0f0;padding:4px 8px;border-radius:4px">${tempPassword}</code></p>
        </div>
        <p>Por seguridad, deberás cambiar tu contraseña al iniciar sesión por primera vez.</p>`
      : `<p>Ya puedes acceder al portal con el correo que utilizaste al registrarte.</p>`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#2d7a2d;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0">Oasis Training Center</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9">
          <h2>¡Bienvenido/a, ${name}!</h2>
          <p>Tu cuenta ha sido creada exitosamente en Oasis Training Center.</p>
          ${credentialsSection}
          <div style="text-align:center;margin:30px 0">
            <a href="${loginUrl}" style="background:#2d7a2d;color:#fff;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold">
              Acceder al Portal
            </a>
          </div>
          <p style="color:#888;font-size:12px">Si no esperabas este correo, puedes ignorarlo.</p>
        </div>
      </div>`;
    return this.sendMail(to, 'Bienvenido a Oasis Training Center', html);
  }

  async sendPasswordChange(to: string, name: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#2d7a2d;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0">Oasis Training Center</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9">
          <h2>Contraseña actualizada</h2>
          <p>Hola ${name}, tu contraseña ha sido cambiada exitosamente.</p>
          <p>Si no realizaste este cambio, contacta al administrador inmediatamente.</p>
        </div>
      </div>`;
    return this.sendMail(to, 'Contraseña actualizada — Oasis Training Center', html);
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#2d7a2d;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0">Oasis Training Center</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9">
          <h2>Recuperación de contraseña</h2>
          <p>Hola ${name}, recibimos una solicitud para restablecer tu contraseña.</p>
          <div style="text-align:center;margin:30px 0">
            <a href="${resetUrl}" style="background:#2d7a2d;color:#fff;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold">
              Restablecer contraseña
            </a>
          </div>
          <p>Este enlace expirará en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      </div>`;
    return this.sendMail(to, 'Recuperación de contraseña — Oasis Training Center', html);
  }

  async sendPaymentReceived(to: string, name: string, amount: number, method: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#2d7a2d;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0">Oasis Training Center</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9">
          <h2>Pago recibido</h2>
          <p>Hola ${name}, hemos recibido tu pago correctamente.</p>
          <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:20px 0">
            <p><strong>Monto:</strong> $${amount.toLocaleString('es-MX')}</p>
            <p><strong>Método:</strong> ${method}</p>
            <p><strong>Estado:</strong> <span style="color:green">Aprobado</span></p>
          </div>
        </div>
      </div>`;
    return this.sendMail(to, 'Pago recibido — Oasis Training Center', html);
  }

  async sendPaymentApproved(to: string, name: string, amount: number, planName: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#2d7a2d;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0">Oasis Training Center</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9">
          <h2 style="color:#2d7a2d">¡Pago aprobado!</h2>
          <p>Hola ${name}, tu transferencia bancaria ha sido aprobada.</p>
          <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:20px 0">
            <p><strong>Membresía:</strong> ${planName}</p>
            <p><strong>Monto:</strong> $${amount.toLocaleString('es-MX')}</p>
            <p><strong>Estado:</strong> <span style="color:green;font-weight:bold">✓ Aprobado</span></p>
          </div>
          <p>Ya puedes acceder a todos los servicios de tu membresía. ¡Nos vemos en el gym!</p>
        </div>
      </div>`;
    return this.sendMail(to, 'Pago aprobado — Oasis Training Center', html);
  }

  async sendPaymentRejected(to: string, name: string, amount: number, reason?: string) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#c0392b;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0">Oasis Training Center</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9">
          <h2 style="color:#c0392b">Pago rechazado</h2>
          <p>Hola ${name}, lamentablemente tu transferencia bancaria fue rechazada.</p>
          <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:20px 0">
            <p><strong>Monto:</strong> $${amount.toLocaleString('es-MX')}</p>
            ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
          </div>
          <p>Por favor contacta a recepción para más información.</p>
        </div>
      </div>`;
    return this.sendMail(to, 'Pago rechazado — Oasis Training Center', html);
  }

  async sendMembershipExpiring(to: string, name: string, planName: string, expiryDate: Date) {
    const formattedDate = expiryDate.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#e67e22;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0">Oasis Training Center</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9">
          <h2>Tu membresía está por vencer</h2>
          <p>Hola ${name}, te recordamos que tu membresía vence pronto.</p>
          <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:20px 0">
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Fecha de vencimiento:</strong> ${formattedDate}</p>
          </div>
          <p>Renueva a tiempo para no perder el acceso. ¡Te esperamos!</p>
        </div>
      </div>`;
    return this.sendMail(to, 'Tu membresía vence pronto — Oasis Training Center', html);
  }

  async sendMembershipExpired(to: string, name: string, planName: string, expiryDate: Date) {
    const formattedDate = expiryDate.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#7f8c8d;padding:20px;text-align:center">
          <h1 style="color:#fff;margin:0">Oasis Training Center</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9">
          <h2 style="color:#7f8c8d">Tu membresía ha vencido</h2>
          <p>Hola ${name}, te informamos que tu membresía ha expirado.</p>
          <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:20px 0">
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Fecha de vencimiento:</strong> ${formattedDate}</p>
          </div>
          <p>Para seguir disfrutando de nuestros servicios, renueva tu membresía en recepción o contáctanos. ¡Te esperamos!</p>
        </div>
      </div>`;
    return this.sendMail(to, 'Tu membresía ha vencido — Oasis Training Center', html);
  }
}
