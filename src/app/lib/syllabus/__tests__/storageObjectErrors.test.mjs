import assert from 'node:assert/strict'
import test from 'node:test'
import { isMissingStorageObject } from '../storageObjectErrors.server.mjs'
const wrapped = (body, status = 400) => ({ name: 'StorageUnknownError', message: '{}', originalError: new Response(JSON.stringify(body), { status }) })
test('wrapped HTTP 400 with a 404 NoSuchKey body is confirmed absence without consuming the response', async () => {
  const error = wrapped({ statusCode: '404', error: 'not_found', message: 'Object not found', code: 'NoSuchKey' })
  assert.equal(await isMissingStorageObject(error), true)
  assert.equal(error.originalError.bodyUsed, false)
  assert.equal(await isMissingStorageObject(error), true)
})
for (const error of [{ statusCode: '404', message: 'Object not found' }, { status: 404, code: 'NoSuchKey' }, { cause: wrapped({ code: 'NoSuchKey' }) }]) {
  test('structured or wrapped object absence is accepted', async () => assert.equal(await isMissingStorageObject(error), true))
}
for (const [label, error] of [
  ['permission', wrapped({ code: 'AccessDenied', message: 'Access denied' }, 403)],
  ['auth even with misleading missing body', wrapped({ code: 'NoSuchKey' }, 401)],
  ['server outage', wrapped({ code: 'NoSuchKey' }, 500)],
  ['rate limit', wrapped({ code: 'NoSuchKey' }, 429)],
  ['missing bucket', wrapped({ code: 'NoSuchBucket', statusCode: '404', message: 'Bucket not found' })],
  ['legacy missing bucket', { statusCode: '404', message: 'Bucket not found' }],
  ['network', new TypeError('fetch failed')],
  ['unreadable response', { originalError: new Response('<html>not found</html>', { status: 404 }) }],
  ['generic unknown', { message: 'not found', status: 404 }],
]) test(`${label} never starts generation as though the object were absent`, async () => assert.equal(await isMissingStorageObject(error), false))
