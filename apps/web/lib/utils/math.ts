import { parseUnits } from 'ethers'

export const toBigInt = (value: any): bigint => {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(Math.floor(value))
  if (typeof value === 'string') return BigInt(value)
  if (value && typeof value.toString === 'function') {
    return BigInt(value.toString())
  }
  throw new Error('Cannot convert value to BigInt')
}

export const toDeadline = (minutes: number) => BigInt(Math.floor(Date.now() / 1000) + minutes * 60)

export const parseAmount = (amount: string, decimals: number) => parseUnits(amount || '0', decimals)
