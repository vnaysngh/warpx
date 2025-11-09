import fallbackManifest from './sample-staking.json'

export type StakingProgram = {
  label: string
  contract: string
  implementation?: string
  stakingToken: string
  rewardsToken: string
  rewardsDuration: number
  owner?: string
  rewardsDistributor?: string
  proxyAdmin?: string
}

export type StakingManifest = {
  network: string
  programs: StakingProgram[]
}

const fallback = fallbackManifest as StakingManifest

export async function loadStakingManifest(networkOverride?: string): Promise<StakingManifest> {
  const envNetwork =
    networkOverride || process.env.NEXT_PUBLIC_MEGAETH_NETWORK || 'megaethTestnet'

  const manifestPaths = [
    `/deployments/${envNetwork}.staking.json`,
    `/deployments/${envNetwork.toLowerCase()}.staking.json`
  ]

  for (const manifestPath of manifestPaths) {
    try {
      const response = await fetch(manifestPath, { cache: 'no-store' })
      if (response.ok) {
        return (await response.json()) as StakingManifest
      }
    } catch (error) {
      console.warn('[staking] failed to load manifest', manifestPath, error)
    }
  }

  return fallback
}

