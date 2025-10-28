import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserProvider, Eip1193Provider, JsonRpcSigner, Network } from 'ethers'

export type WalletState = {
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  account: string | null
  network: Network | null
  isConnecting: boolean
  error: string | null
}

const INITIAL_STATE: WalletState = {
  provider: null,
  signer: null,
  account: null,
  network: null,
  isConnecting: false,
  error: null
}

const getEthereum = (): Eip1193Provider | undefined => {
  if (typeof window !== 'undefined') {
    return (window as any).ethereum as Eip1193Provider | undefined
  }
  return undefined
}

export const useWallet = () => {
  const [state, setState] = useState<WalletState>(INITIAL_STATE)

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  const connect = useCallback(async () => {
    const ethereum = getEthereum()
    if (!ethereum) {
      setState(prev => ({ ...prev, error: 'No EIP-1193 provider found. Install MetaMask or similar wallet.' }))
      return
    }
    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }))
      const provider = new BrowserProvider(ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()
      console.log('[wallet] connected account', accounts[0], 'chain', network.chainId.toString())
      setState({
        provider,
        signer,
        account: accounts[0]?.toLowerCase() ?? null,
        network,
        isConnecting: false,
        error: null
      })
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error?.message ?? 'Failed to connect wallet'
      }))
    }
  }, [])

  useEffect(() => {
    const ethereum = getEthereum()
    if (!ethereum) return
    const emitter = ethereum as any

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[wallet] accountsChanged', accounts)
      setState(prev => ({
        ...prev,
        account: accounts[0]?.toLowerCase() ?? null
      }))
    }

    const handleChainChanged = () => {
      console.log('[wallet] chainChanged – reloading')
      window.location.reload()
    }

    emitter?.on?.('accountsChanged', handleAccountsChanged)
    emitter?.on?.('chainChanged', handleChainChanged)

    return () => {
      emitter?.removeListener?.('accountsChanged', handleAccountsChanged)
      emitter?.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [])

  const value = useMemo(
    () => ({ ...state, connect, reset }),
    [state, connect, reset]
  )

  return value
}
