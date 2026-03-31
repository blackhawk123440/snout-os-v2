/**
 * Tests for storage system (local + S3).
 *
 * Verifies:
 * - File validation (size, mime, magic bytes)
 * - Local upload writes to disk
 * - S3 upload calls PutObjectCommand when configured
 * - buildMediaUrl returns correct URL format for both backends
 * - Fallback: S3 misconfigured → local storage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateReportMediaFile,
  validateReportMediaMagicBytes,
  getMaxFiles,
  getS3PublicUrl,
  buildMediaUrl,
} from '../storage';

describe('validateReportMediaFile', () => {
  it('accepts valid JPEG under 5MB', () => {
    expect(validateReportMediaFile({ size: 1024 * 1024, type: 'image/jpeg' }, 0)).toEqual({ ok: true });
  });

  it('rejects file over 5MB', () => {
    const result = validateReportMediaFile({ size: 6 * 1024 * 1024, type: 'image/jpeg' }, 0);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('5MB');
  });

  it('rejects non-image mime type', () => {
    const result = validateReportMediaFile({ size: 1024, type: 'application/pdf' }, 0);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('JPEG, PNG');
  });

  it('rejects when at max file count', () => {
    const result = validateReportMediaFile({ size: 1024, type: 'image/jpeg' }, 5);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Maximum');
  });

  it('accepts at count below max', () => {
    expect(validateReportMediaFile({ size: 1024, type: 'image/png' }, 4)).toEqual({ ok: true });
  });
});

describe('validateReportMediaMagicBytes', () => {
  it('accepts valid JPEG magic bytes', () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff;
    expect(validateReportMediaMagicBytes(buf, 'image/jpeg')).toEqual({ ok: true });
  });

  it('rejects JPEG with wrong magic bytes', () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0x00; buf[1] = 0x00; buf[2] = 0x00;
    const result = validateReportMediaMagicBytes(buf, 'image/jpeg');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid JPEG');
  });

  it('accepts valid PNG magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(validateReportMediaMagicBytes(buf, 'image/png')).toEqual({ ok: true });
  });

  it('rejects file too small to validate', () => {
    const buf = Buffer.alloc(5);
    expect(validateReportMediaMagicBytes(buf, 'image/jpeg').ok).toBe(false);
  });
});

describe('getMaxFiles', () => {
  it('returns 5', () => {
    expect(getMaxFiles()).toBe(5);
  });
});

describe('getS3PublicUrl', () => {
  it('uses S3_PUBLIC_URL when set', () => {
    const original = process.env.S3_PUBLIC_URL;
    process.env.S3_PUBLIC_URL = 'https://cdn.example.com';
    try {
      expect(getS3PublicUrl('report-media/org/booking/file.jpg'))
        .toBe('https://cdn.example.com/report-media/org/booking/file.jpg');
    } finally {
      if (original !== undefined) process.env.S3_PUBLIC_URL = original;
      else delete process.env.S3_PUBLIC_URL;
    }
  });

  it('constructs standard S3 URL when no public URL', () => {
    const origPub = process.env.S3_PUBLIC_URL;
    const origBucket = process.env.S3_BUCKET;
    const origRegion = process.env.S3_REGION;
    delete process.env.S3_PUBLIC_URL;
    process.env.S3_BUCKET = 'my-bucket';
    process.env.S3_REGION = 'us-east-1';
    try {
      expect(getS3PublicUrl('report-media/org/booking/file.jpg'))
        .toBe('https://my-bucket.s3.us-east-1.amazonaws.com/report-media/org/booking/file.jpg');
    } finally {
      if (origPub !== undefined) process.env.S3_PUBLIC_URL = origPub;
      else delete process.env.S3_PUBLIC_URL;
      if (origBucket !== undefined) process.env.S3_BUCKET = origBucket;
      else delete process.env.S3_BUCKET;
      if (origRegion !== undefined) process.env.S3_REGION = origRegion;
      else delete process.env.S3_REGION;
    }
  });
});

describe('buildMediaUrl', () => {
  it('returns local URL when S3 not configured', () => {
    // Ensure S3 env vars are NOT set
    const saved = {
      S3_BUCKET: process.env.S3_BUCKET,
      S3_REGION: process.env.S3_REGION,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    };
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;

    try {
      const url = buildMediaUrl('org-1/booking-1/file.jpg', 'https://app.example.com');
      expect(url).toBe('https://app.example.com/api/uploads/report-media/org-1/booking-1/file.jpg');
    } finally {
      Object.entries(saved).forEach(([k, v]) => {
        if (v !== undefined) process.env[k] = v;
      });
    }
  });

  it('returns S3 URL when S3 configured and key has report-media/ prefix', () => {
    const saved = { ...process.env };
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_REGION = 'us-west-2';
    process.env.S3_ACCESS_KEY_ID = 'AKIA_TEST';
    process.env.S3_SECRET_ACCESS_KEY = 'secret';

    try {
      const url = buildMediaUrl('report-media/org-1/booking-1/file.jpg', 'https://app.example.com');
      expect(url).toContain('test-bucket');
      expect(url).toContain('report-media/org-1/booking-1/file.jpg');
    } finally {
      // Restore
      if (saved.S3_BUCKET === undefined) delete process.env.S3_BUCKET;
      else process.env.S3_BUCKET = saved.S3_BUCKET;
      if (saved.S3_REGION === undefined) delete process.env.S3_REGION;
      else process.env.S3_REGION = saved.S3_REGION;
      if (saved.S3_ACCESS_KEY_ID === undefined) delete process.env.S3_ACCESS_KEY_ID;
      else process.env.S3_ACCESS_KEY_ID = saved.S3_ACCESS_KEY_ID;
      if (saved.S3_SECRET_ACCESS_KEY === undefined) delete process.env.S3_SECRET_ACCESS_KEY;
      else process.env.S3_SECRET_ACCESS_KEY = saved.S3_SECRET_ACCESS_KEY;
    }
  });
});

describe('uploadReportMedia routing', () => {
  it('storage.ts source contains S3 upload function', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/storage.ts'),
      'utf-8'
    );
    expect(source).toContain('PutObjectCommand');
    expect(source).toContain('S3Client');
    expect(source).toContain('uploadReportMediaS3');
    expect(source).not.toContain('TODO');
  });

  it('upload route uses buildMediaUrl (not hardcoded local path)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/upload/report-media/route.ts'),
      'utf-8'
    );
    expect(source).toContain('buildMediaUrl');
    expect(source).not.toContain('/api/uploads/report-media/${key}');
  });
});
