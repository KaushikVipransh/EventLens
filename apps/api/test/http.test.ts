import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { HttpError, badRequest, parse } from '../src/http.js';

test('parse returns data on valid input', () => {
  const schema = z.object({ n: z.number() });
  assert.deepEqual(parse(schema, { n: 5 }), { n: 5 });
});

test('parse throws a 400 HttpError on invalid input', () => {
  const schema = z.object({ n: z.number() });
  assert.throws(
    () => parse(schema, { n: 'nope' }),
    (err: unknown) => err instanceof HttpError && err.statusCode === 400,
  );
});

test('badRequest builds a 400 error', () => {
  const e = badRequest('bad');
  assert.equal(e.statusCode, 400);
  assert.equal(e.message, 'bad');
});
