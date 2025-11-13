import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export const FACTORY_ADDRESS = Address.fromString('0x4C40BA03b676bc14bFC8A7DAeBc361C05CbB6867')
export const WMegaETH_ADDRESS = Address.fromString('0xA51EbEdb0970133D016444Be0049efFE9257D06A')

export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BD = BigDecimal.fromString('0')
export const ONE_BD = BigDecimal.fromString('1')
export const TWO_BD = BigDecimal.fromString('2')
export const BI_18 = BigInt.fromI32(18)

export const BUNDLE_ID = '1'

// Trackers modeled after the legacy v2 schema.
export const MINIMUM_USD_TRACKED = BigDecimal.fromString('1000')
export const MINIMUM_ETH_LOCKED = BigDecimal.fromString('1')

export const WHITELIST_TOKENS: Address[] = [
  WMegaETH_ADDRESS,
  Address.fromString('0xA78FAa476Ee5aC877ddF77F7969e3410965B8376'), // WARPX
  Address.fromString('0x9629684df53db9e4484697d0a50c442b2bfa80a8'), // GTE
  Address.fromString('0x10a6be7d23989d00d528e68cf8051d095f741145'), // MEGA
  Address.fromString('0xe9b6e75c243b6100ffcb1c66e8f78f96feea727f') // cUSD
]

export const USD_TOKENS: Address[] = [Address.fromString('0xe9b6e75c243b6100ffcb1c66e8f78f96feea727f')]
