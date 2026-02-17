// ThoughtHub chronograph endpoint alias.
// This route forwards to the existing mentor-chronograph implementation.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export { GET } from '../mentor-chronograph/route'
