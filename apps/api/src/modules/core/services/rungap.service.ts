import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiEnvSchemaType, RunGapConnectionDto } from '@openathlete/shared';

import { RUNGAP_WEBHOOK_PATH } from '../../../common/security/payload-limits';
import { AuthUser } from '../../auth/decorators/user.decorator';
import { mcpUrls } from '../../mcp/mcp-urls';
import { PrismaService } from '../../prisma/services/prisma.service';
import { ManualFitImportService } from './manual-fit-import.service';

@Injectable()
export class RunGapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnvSchemaType, true>,
    private readonly importer: ManualFitImportService,
  ) {}

  async connection(user: AuthUser): Promise<RunGapConnectionDto> {
    const athlete = await this.prisma.athlete.findUnique({
      where: { userId: user.userId },
      select: { rungapWebhookId: true },
    });
    if (!athlete) throw new ForbiddenException();
    const id = athlete.rungapWebhookId;
    return {
      connection: id
        ? {
            url: `${mcpUrls(this.config).issuer}${RUNGAP_WEBHOOK_PATH}/${id}`,
            passkey: this.passkey(id),
          }
        : null,
    };
  }

  async connect(user: AuthUser): Promise<RunGapConnectionDto> {
    await this.prisma.athlete.updateMany({
      where: { userId: user.userId, rungapWebhookId: null },
      data: { rungapWebhookId: randomUUID() },
    });
    return this.connection(user);
  }

  async disconnect(user: AuthUser): Promise<void> {
    await this.prisma.athlete.updateMany({
      where: { userId: user.userId, rungapWebhookId: { not: null } },
      data: { rungapWebhookId: null },
    });
  }

  private passkey(id: string): string {
    return createHmac('sha256', this.config.getOrThrow('HASH_PEPPER'))
      .update(`rungap:v1:${id}`)
      .digest('base64url');
  }

  async receive(
    id: string,
    body: unknown,
    contentType: string | undefined,
    signature: string | undefined,
  ): Promise<{ ok: true }> {
    if (!signature || !/^[0-9a-f]{64}$/.test(signature))
      throw new UnauthorizedException();
    if (!Buffer.isBuffer(body) || !contentType)
      throw new BadRequestException('Expected RunGap multipart data');

    const athlete = await this.prisma.athlete.findUnique({
      where: { rungapWebhookId: id },
      select: {
        rungapWebhookId: true,
        user: { select: { userId: true, email: true } },
      },
    });
    if (!athlete?.rungapWebhookId) throw new UnauthorizedException();

    const expected = createHmac('sha256', this.passkey(athlete.rungapWebhookId))
      .update(body)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw new UnauthorizedException();

    let form: FormData;
    try {
      form = await new Response(new Uint8Array(body), {
        headers: { 'Content-Type': contentType },
      }).formData();
    } catch {
      throw new BadRequestException('Invalid RunGap multipart data');
    }
    const parts = Array.from(form.values());
    const files = parts
      .filter((part) => typeof part !== 'string')
      .filter(
        (part) =>
          part.name.toLowerCase().endsWith('.fit') ||
          part.type === 'application/octet-stream',
      );
    const [file] = files;
    if (!file || files.length !== 1)
      throw new BadRequestException('Expected one RunGap FIT file');

    const metadata =
      parts.find(
        (part) =>
          typeof part !== 'string' &&
          (part.type === 'application/json' ||
            part.name.toLowerCase().endsWith('.json')),
      ) ?? form.get('metadata');
    const filename = file.name.replace(/\.fit$/i, '').trim();
    const name = ((await runGapTitle(metadata)) || filename || 'RunGap').slice(
      0,
      100,
    );

    try {
      const imported = await this.importer.import(
        { ...athlete.user, athlete: null },
        {
          originalname: file.name.toLowerCase().endsWith('.fit')
            ? file.name
            : 'activity.fit',
          size: file.size,
          buffer: Buffer.from(await file.arrayBuffer()),
        },
        name,
      );
      if (!imported.processingQueued) throw new ServiceUnavailableException();
    } catch (error) {
      // RunGap may send a workout already saved by another connected source.
      if (
        !(error instanceof ConflictException) ||
        error.message !== 'FIT_DUPLICATE_TIME'
      )
        throw error;
    }
    return { ok: true };
  }
}

async function runGapTitle(part: FormDataEntryValue | null): Promise<string> {
  if (part === null) return '';
  try {
    const value: unknown = JSON.parse(
      typeof part === 'string' ? part : await part.text(),
    );
    if (
      value &&
      typeof value === 'object' &&
      'title' in value &&
      typeof value.title === 'string'
    )
      return value.title.trim();
  } catch {
    // The FIT file still imports if RunGap omits usable title metadata.
  }
  return '';
}
