import { useEffect, useState } from 'react'
import type { StakingManifest, StakingProgram } from '@/lib/config/staking'
import { loadStakingManifest } from '@/lib/config/staking'

export function useStakingManifest(network?: string | null) {
  const [programs, setPrograms] = useState<StakingProgram[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchManifest = async () => {
      if (!network) {
        if (mounted) setPrograms([])
        return
      }
      try {
        setLoading(true)
        const manifest: StakingManifest = await loadStakingManifest(network)
        if (mounted) {
          setPrograms(manifest.programs ?? [])
        }
      } catch (error) {
        console.warn('[staking] manifest load failed', error)
        if (mounted) setPrograms([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchManifest()
    return () => {
      mounted = false
    }
  }, [network])

  return { programs, loading }
}

