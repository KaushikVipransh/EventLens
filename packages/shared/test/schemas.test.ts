import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACE_EMBEDDING_DIM,
  detectEmbedResponseSchema,
  embeddingSchema,
  presignRequestSchema,
  signupSchema,
} from '../src/index.js';

test('signupSchema rejects short passwords', () => {
  assert.equal(signupSchema.safeParse({ email: 'a@b.com', password: 'short', name: 'X' }).success, false);
});

test('signupSchema accepts valid input', () => {
  assert.equal(
    signupSchema.safeParse({ email: 'a@b.com', password: 'longenough', name: 'X' }).success,
    true,
  );
});

test('presignRequestSchema rejects unsupported content types', () => {
  const r = presignRequestSchema.safeParse({
    files: [{ filename: 'x.gif', contentType: 'image/gif', size: 10 }],
  });
  assert.equal(r.success, false);
});

test('embeddingSchema enforces exact dimensionality', () => {
  assert.equal(embeddingSchema.safeParse(new Array(FACE_EMBEDDING_DIM).fill(0)).success, true);
  assert.equal(embeddingSchema.safeParse(new Array(FACE_EMBEDDING_DIM - 1).fill(0)).success, false);
});

test('detectEmbedResponseSchema parses a face', () => {
  const r = detectEmbedResponseSchema.safeParse({
    faces: [{ bbox: [1, 2, 3, 4], detScore: 0.9, embedding: new Array(FACE_EMBEDDING_DIM).fill(0.1) }],
  });
  assert.equal(r.success, true);
});
