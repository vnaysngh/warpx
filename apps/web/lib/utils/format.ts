import { formatUnits } from 'ethers'

export const shortAddress = (address?: string | null, chars = 4) => {
  if (!address) return '—'
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`
}

export const formatAmount = (value: bigint | null | undefined, decimals = 18, precision = 4) => {
  if (value === undefined || value === null) return '0'
  try {
    const formatted = formatUnits(value, decimals)
    const [whole, fraction = ''] = formatted.split('.')
    if (!fraction) return whole
    return `${whole}.${fraction.slice(0, precision)}`
  } catch (error) {
    return value.toString()
  }
}
