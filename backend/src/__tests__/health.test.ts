import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('GET /api/v1/health', () => {
  const app = createApp();

  it('reports healthy only after a real database round trip', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'healthy', database: 'up', version: '1.0.0' });
    expect(res.body.data.dbLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('answers 404 NOT_FOUND for an unknown route', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
