import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import { PairCreated } from '../../generated/WarpFactory/WarpFactory'
import { WarpPair as WarpPairTemplate } from '../../generated/templates'
import { Bundle, Pair } from '../../generated/schema'
import { BUNDLE_ID, ONE_BD, ZERO_BD } from './constants'
import { getETHPriceInUSD, getFactory, getToken } from './helpers'

export function handlePairCreated(event: PairCreated): void {
  let factory = getFactory()
  factory.pairCount = factory.pairCount.plus(BigInt.fromI32(1))
  factory.save()

  let token0 = getToken(event.params.token0)
  let token1 = getToken(event.params.token1)

  let pair = new Pair(event.params.pair.toHexString())
  pair.token0 = token0.id
  pair.token1 = token1.id
  pair.reserve0 = ZERO_BD
  pair.reserve1 = ZERO_BD
  pair.totalSupply = ZERO_BD
  pair.reserveUSD = ZERO_BD
  pair.reserveETH = ZERO_BD
  pair.trackedReserveETH = ZERO_BD
  pair.trackedReserveUSD = ZERO_BD
  pair.token0Price = ONE_BD
  pair.token1Price = ONE_BD
  pair.volumeToken0 = ZERO_BD
  pair.volumeToken1 = ZERO_BD
  pair.volumeUSD = ZERO_BD
  pair.untrackedVolumeUSD = ZERO_BD
  pair.txCount = BigInt.zero()
  pair.liquidityProviderCount = BigInt.zero()
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.save()

  WarpPairTemplate.create(event.params.pair)
}

export function handleBlock(block: ethereum.Block): void {
  if (block.number.mod(BigInt.fromI32(3)).notEqual(BigInt.fromI32(0))) return
  let bundle = Bundle.load(BUNDLE_ID)
  if (bundle === null) {
    bundle = new Bundle(BUNDLE_ID)
  }
  bundle.ethPrice = getETHPriceInUSD()
  bundle.save()
}
