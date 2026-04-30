import { CampaignsView } from '@/features/campaigns/components/campaigns-view'

export default async function CampaignTablesByCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const { campaignId } = await params

  return <CampaignsView mode="tables" preferredCampaignId={campaignId} />
}