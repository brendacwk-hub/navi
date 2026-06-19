import { IdeasView } from '@/features/personal/ideas/IdeasView'

export default async function IdeasPage({
  params,
}: {
  params: Promise<{ cat?: string[] }>
}) {
  const { cat } = await params
  return <IdeasView cat={cat?.[0]} />
}
