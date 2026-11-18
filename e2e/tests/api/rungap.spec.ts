import { type APIRequestContext, expect, test } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { apiHeaders, createAthlete } from '../../support/api';
import { API_URL, WEB_URL } from '../../support/env';

const FIT = readFileSync(
  path.join(import.meta.dirname, '../../fixtures/synthetic-run.fit'),
);
const GPX = readFileSync(
  path.join(import.meta.dirname, '../../fixtures/synthetic-run.gpx'),
  'utf8',
);
const connections = `${API_URL}/activity-import/rungap/connection`;
const calendar = `${API_URL}/event?startDate=2024-05-01&endDate=2024-05-02`;

async function connect(request: APIRequestContext, accessToken: string) {
  const response = await request.post(connections, {
    headers: apiHeaders(undefined, accessToken),
  });
  expect(response.status()).toBe(200);
  const { connection } = (await response.json()) as {
    connection: { url: string; passkey: string };
  };
  expect(connection.url).toMatch(/\/activity-import\/rungap\/[0-9a-f-]+$/);
  return connection;
}

const boundary = 'rungap-e2e-boundary';

function multipart(fit: Buffer, title?: string) {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="activity"; filename="morning.fit"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    fit,
    Buffer.from('\r\n'),
    title
      ? Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="metadata"; filename="activity.json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ title })}\r\n`,
        )
      : Buffer.alloc(0),
    Buffer.from(`--${boundary}--\r\n`),
  ]);
}

function delivery(body: Buffer, passkey: string) {
  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'X-RunGap-HMAC-SHA256': createHmac('sha256', passkey)
        .update(body)
        .digest('hex'),
    },
    data: body,
  };
}

test('imports a signed RunGap workout once and revokes its connection', async ({
  request,
}) => {
  const [athlete, other] = await Promise.all([
    createAthlete(request),
    createAthlete(request),
  ]);
  const headers = apiHeaders(undefined, athlete.accessToken);
  expect((await request.get(connections)).status()).toBe(401);
  expect(await (await request.get(connections, { headers })).json()).toEqual({
    connection: null,
  });
  const { url, passkey } = await connect(request, athlete.accessToken);
  const otherConnection = await connect(request, other.accessToken);
  expect(new URL(url).origin).toBe(new URL(WEB_URL).origin);
  expect(await connect(request, athlete.accessToken)).toEqual({ url, passkey });

  const body = multipart(FIT, 'Morning run from RunGap');
  const upload = delivery(body, passkey);
  const tampered = Buffer.from(body);
  tampered[0] ^= 1;
  expect(
    (await request.post(url, { ...upload, data: tampered })).status(),
  ).toBe(401);
  expect(
    (await request.post(url, delivery(body, otherConnection.passkey))).status(),
  ).toBe(401);
  expect(await (await request.get(calendar, { headers })).json()).toEqual([]);

  for (let i = 0; i < 2; i++) {
    const result = await request.post(url, upload);
    expect(result.status(), await result.text()).toBe(200);
  }
  const events = await (await request.get(calendar, { headers })).json();
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    name: 'Morning run from RunGap',
    startDate: '2024-05-01T07:00:00.000Z',
  });
  expect(
    await (
      await request.get(calendar, {
        headers: apiHeaders(undefined, other.accessToken),
      })
    ).json(),
  ).toEqual([]);

  expect((await request.delete(connections, { headers })).status()).toBe(204);
  expect((await request.post(url, upload)).status()).toBe(401);
  expect(await connect(request, athlete.accessToken)).not.toEqual({
    url,
    passkey,
  });
});

test('falls back to the FIT filename and rejects oversized or invalid files', async ({
  request,
}) => {
  const { accessToken } = await createAthlete(request);
  const { url, passkey } = await connect(request, accessToken);
  for (const [file, status] of [
    [Buffer.alloc(22 * 1024 * 1024), 413],
    [Buffer.from('not a FIT file'), 400],
    [FIT, 200],
  ] as const) {
    const response = await request.post(
      url,
      delivery(multipart(file), passkey),
    );
    expect(response.status(), await response.text()).toBe(status);
  }
  const response = await request.get(calendar, {
    headers: apiHeaders(undefined, accessToken),
  });
  expect(await response.json()).toMatchObject([{ name: 'morning' }]);
});

test('acknowledges a workout that already exists at the same start time', async ({
  request,
}) => {
  const { accessToken } = await createAthlete(request);
  const headers = apiHeaders(undefined, accessToken);
  const existing = await request.post(`${API_URL}/activity-import/gpx`, {
    headers,
    multipart: {
      file: {
        name: 'existing.gpx',
        mimeType: 'application/gpx+xml',
        buffer: Buffer.from(GPX.replaceAll('2024-05-02T', '2024-05-01T')),
      },
      name: 'Existing run',
    },
  });
  expect(existing.status(), await existing.text()).toBe(201);
  const { url, passkey } = await connect(request, accessToken);
  const response = await request.post(url, delivery(multipart(FIT), passkey));
  expect(response.status(), await response.text()).toBe(200);
  expect(await (await request.get(calendar, { headers })).json()).toMatchObject(
    [{ name: 'Existing run' }],
  );
});
