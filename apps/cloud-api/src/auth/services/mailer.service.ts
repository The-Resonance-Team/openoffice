import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import type { Mail } from './mailer.type'

/**
 * Email boundary (cloud ADR 0006: verification/reset/invite mail). Sends via
 * Resend when RESEND_API_KEY is set; logs the full message — token included —
 * to the console otherwise, so local dev and tests get working flows with no
 * provider account.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name)
  private readonly resend: Resend | null
  private readonly from: string
  private readonly webAppUrl: string

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('resend.from')
    this.webAppUrl = config.getOrThrow<string>('webAppUrl')
    const apiKey = config.get<string>('resend.apiKey')
    this.resend = apiKey ? new Resend(apiKey) : null
  }

  /** Absolute link for email bodies. */
  link(path: string, token: string): string {
    return `${this.webAppUrl}${path}?token=${token}`
  }

  async send(mail: Mail): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[dev mailer] to=${mail.to} subject="${mail.subject}"\n${mail.text}`)
      return
    }
    await this.resend.emails.send({
      from: this.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    })
  }
}
