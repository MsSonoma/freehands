import { redirect } from 'next/navigation'

export default function LearnersPage() {
  redirect('/facilitator?overlay=learners')
}
