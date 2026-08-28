import crypto from 'crypto'

export function verifyFacilitatorPinHash(pin, stored) {
  if (typeof pin !== 'string' || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 's1') return false
  const [, salt, hex] = parts
  const derived = crypto.scryptSync(pin, salt, 64, { N: 16384, r: 8, p: 1 })
  const expected = Buffer.from(`s1$${salt}$${hex}`)
  const actual = Buffer.from(`s1$${salt}$${derived.toString('hex')}`)
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected)
}

export async function verifyFacilitatorPinForUser(admin, userId, pin) {
  if (!pin) return false
  const { data, error } = await admin.from('profiles').select('facilitator_pin_hash').eq('id', userId).maybeSingle()
  if (error) throw error
  return verifyFacilitatorPinHash(pin, data?.facilitator_pin_hash)
}
