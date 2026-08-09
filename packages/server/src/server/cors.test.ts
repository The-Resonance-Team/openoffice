import { describe, expect, test, afterEach } from 'bun:test';
import { loadCorsOrigins } from './cors';

afterEach(() => {
  delete process.env.OPENOFFICE_SERVER_CORS_ORIGIN;
});

describe('loadCorsOrigins', () => {
  test('empty when env unset', () => {
    delete process.env.OPENOFFICE_SERVER_CORS_ORIGIN;
    expect(loadCorsOrigins()).toEqual([]);
  });

  test('parses a comma-separated list and trims whitespace', () => {
    process.env.OPENOFFICE_SERVER_CORS_ORIGIN = 'http://localhost:3000, http://localhost:3001';
    expect(loadCorsOrigins()).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  test('drops a wildcard origin', () => {
    process.env.OPENOFFICE_SERVER_CORS_ORIGIN = '*';
    expect(loadCorsOrigins()).toEqual([]);
  });

  test('drops wildcard but keeps real origins in a mixed list', () => {
    process.env.OPENOFFICE_SERVER_CORS_ORIGIN = '*, http://localhost:3000';
    expect(loadCorsOrigins()).toEqual(['http://localhost:3000']);
  });
});
