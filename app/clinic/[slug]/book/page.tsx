import { getClinicBySlug } from '@/lib/clinic'
import { notFound } from 'next/navigation'
import BookingWidget from './BookingWidget'

export default async function BookPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clinic = await getClinicBySlug(slug)
  if (!clinic) notFound()

  return <BookingWidget clinic={clinic} />
}
