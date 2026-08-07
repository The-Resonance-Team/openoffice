import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Email boundary (cloud ADR 0006: verification/reset/invite mail). Uses SMTP
 * when configured; logs the full message — token included — to the console
 * otherwise, so local dev and tests get working flows with no mail server.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly webAppUrl: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>("smtp.from") ?? "no-reply@openoffice.dev";
    this.webAppUrl = config.get<string>("webAppUrl") ?? "http://localhost:3002";
    const host = config.get<string>("smtp.host");
    const port = config.get<number>("smtp.port") ?? 587;
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user: config.get<string>("smtp.user") ?? "",
            pass: config.get<string>("smtp.pass") ?? "",
          },
        })
      : null;
  }

  /** Absolute link for email bodies. */
  link(path: string, token: string): string {
    return `${this.webAppUrl}${path}?token=${token}`;
  }

  async send(mail: Mail): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[dev mailer] to=${mail.to} subject="${mail.subject}"\n${mail.text}`
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
  }
}
