import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import {
  Burn as BurnEvent,
  Mint as MintEvent,
  Swap as SwapEvent,
  Sync as SyncEvent,
  Transfer as TransferEvent
} from '../../generated/templates/WarpPair/WarpPair'
import { Burn, Mint, Pair, Swap, Token } from '../../generated/schema'
import {
  BI_18,
  ONE_BD,
  ONE_BI,
  ZERO_BD,
  ZERO_BI
} from './constants'
import {
  convertTokenToDecimal,
  createLiquiditySnapshot,
  createTransaction,
  getBundle,
  getFactory,
  getLiquidityPosition,
  getPair,
  getToken,
  getTrackedLiquidityUSD,
  getTrackedVolumeUSD,
  saveMint,
  updateFactoryDayData,
  updatePairDayData,
  updatePairHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateTokenPrices
} from './helpers'

function updateTokenTotals(token: Token): void {
  token.txCount = token.txCount.plus(ONE_BI)
  token.save()
}

export function handleTransfer(event: TransferEvent): void {
  let pair = getPair(event.address)
  if (pair === null) return

  let value = convertTokenToDecimal(event.params.value, BI_18)

  if (event.params.to == Address.zero()) {
    pair.totalSupply = pair.totalSupply.minus(value)
  } else if (event.params.from == Address.zero()) {
    pair.totalSupply = pair.totalSupply.plus(value)
  }
  pair.save()

  if (event.params.from.notEqual(Address.zero())) {
    let fromPosition = getLiquidityPosition(pair, event.params.from)
    fromPosition.liquidityTokenBalance = fromPosition.liquidityTokenBalance.minus(value)
    fromPosition.save()
    createLiquiditySnapshot(fromPosition, event)
  }

  if (event.params.to.notEqual(Address.zero())) {
    let toPosition = getLiquidityPosition(pair, event.params.to)
    toPosition.liquidityTokenBalance = toPosition.liquidityTokenBalance.plus(value)
    toPosition.save()
    createLiquiditySnapshot(toPosition, event)
  }
}

export function handleMint(event: MintEvent): void {
  let pair = getPair(event.address)
  if (pair === null) return
  let token0 = getToken(Address.fromString(pair.token0))
  let token1 = getToken(Address.fromString(pair.token1))

  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  let mint = saveMint(event, pair)
  mint.amount0 = amount0
  mint.amount1 = amount1
  mint.save()

  pair.txCount = pair.txCount.plus(ONE_BI)
  pair.save()

  let factory = getFactory()
  factory.txCount = factory.txCount.plus(ONE_BI)
  factory.save()
}

export function handleBurn(event: BurnEvent): void {
  let pair = getPair(event.address)
  if (pair === null) return
  let token0 = getToken(Address.fromString(pair.token0))
  let token1 = getToken(Address.fromString(pair.token1))

  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  let transaction = createTransaction(event)
  let burn = new Burn(transaction.id.concat('-burn-').concat(event.logIndex.toString()))
  burn.pair = pair.id
  burn.amount0 = amount0
  burn.amount1 = amount1
  burn.transaction = transaction.id
  burn.timestamp = event.block.timestamp
  burn.to = event.params.to
  burn.sender = event.params.sender
  burn.needsComplete = false
  burn.logIndex = event.logIndex
  burn.liquidity = ZERO_BD
  burn.save()

  let burns = transaction.burns
  burns.push(burn.id)
  transaction.burns = burns
  transaction.save()

  pair.txCount = pair.txCount.plus(ONE_BI)
  pair.save()

  let factory = getFactory()
  factory.txCount = factory.txCount.plus(ONE_BI)
  factory.save()
}

export function handleSwap(event: SwapEvent): void {
  let pair = getPair(event.address)
  if (pair === null) return

  let token0 = getToken(Address.fromString(pair.token0))
  let token1 = getToken(Address.fromString(pair.token1))

  let amount0In = convertTokenToDecimal(event.params.amount0In, token0.decimals)
  let amount1In = convertTokenToDecimal(event.params.amount1In, token1.decimals)
  let amount0Out = convertTokenToDecimal(event.params.amount0Out, token0.decimals)
  let amount1Out = convertTokenToDecimal(event.params.amount1Out, token1.decimals)

  let amount0Total = amount0Out.gt(ZERO_BD) ? amount0Out : amount0In
  let amount1Total = amount1Out.gt(ZERO_BD) ? amount1Out : amount1In

  updateTokenPrices(token0, token1)

  let trackedUSD = getTrackedVolumeUSD(token0, token1, amount0Total, amount1Total)
  let bundle = getBundle()
  let derivedUSD = token0.derivedETH.times(bundle.ethPrice)
  let amountUSD = trackedUSD.gt(ZERO_BD)
    ? trackedUSD
    : amount0Total
        .times(derivedUSD)
        .plus(amount1Total.times(token1.derivedETH.times(bundle.ethPrice)))

  pair.volumeToken0 = pair.volumeToken0.plus(amount0Total)
  pair.volumeToken1 = pair.volumeToken1.plus(amount1Total)
  pair.volumeUSD = pair.volumeUSD.plus(amountUSD)
  pair.untrackedVolumeUSD = pair.untrackedVolumeUSD.plus(amountUSD)
  pair.txCount = pair.txCount.plus(ONE_BI)
  pair.save()

  token0.volume = token0.volume.plus(amount0Total)
  token0.volumeUSD = token0.volumeUSD.plus(amountUSD)
  token0.volumeETH = token0.volumeETH.plus(bundle.ethPrice.notEqual(ZERO_BD) ? amountUSD.div(bundle.ethPrice) : ZERO_BD)
  token0.txCount = token0.txCount.plus(ONE_BI)
  token0.save()

  token1.volume = token1.volume.plus(amount1Total)
  token1.volumeUSD = token1.volumeUSD.plus(amountUSD)
  token1.volumeETH = token1.volumeETH.plus(bundle.ethPrice.notEqual(ZERO_BD) ? amountUSD.div(bundle.ethPrice) : ZERO_BD)
  token1.txCount = token1.txCount.plus(ONE_BI)
  token1.save()

  let factory = getFactory()
  factory.totalVolumeUSD = factory.totalVolumeUSD.plus(amountUSD)
  factory.totalVolumeETH = factory.totalVolumeETH.plus(bundle.ethPrice.notEqual(ZERO_BD) ? amountUSD.div(bundle.ethPrice) : ZERO_BD)
  factory.txCount = factory.txCount.plus(ONE_BI)
  factory.save()

  let transaction = createTransaction(event)
  let swap = new Swap(transaction.id.concat('-').concat(event.logIndex.toString()))
  swap.pair = pair.id
  swap.amount0In = amount0In
  swap.amount1In = amount1In
  swap.amount0Out = amount0Out
  swap.amount1Out = amount1Out
  swap.sender = event.params.sender
  swap.to = event.params.to
  swap.timestamp = event.block.timestamp
  swap.transaction = transaction.id
  swap.logIndex = event.logIndex
  swap.amountUSD = amountUSD
  swap.save()
  let swaps = transaction.swaps
  swaps.push(swap.id)
  transaction.swaps = swaps
  transaction.save()

  let pairDay = updatePairDayData(event)
  pairDay.dailyVolumeToken0 = pairDay.dailyVolumeToken0.plus(amount0Total)
  pairDay.dailyVolumeToken1 = pairDay.dailyVolumeToken1.plus(amount1Total)
  pairDay.dailyVolumeUSD = pairDay.dailyVolumeUSD.plus(amountUSD)
  pairDay.dailyTxns = pairDay.dailyTxns.plus(ONE_BI)
  pairDay.save()

  let pairHour = updatePairHourData(event)
  pairHour.hourlyVolumeToken0 = pairHour.hourlyVolumeToken0.plus(amount0Total)
  pairHour.hourlyVolumeToken1 = pairHour.hourlyVolumeToken1.plus(amount1Total)
  pairHour.hourlyVolumeUSD = pairHour.hourlyVolumeUSD.plus(amountUSD)
  pairHour.hourlyTxns = pairHour.hourlyTxns.plus(ONE_BI)
  pairHour.save()

  let token0Day = updateTokenDayData(token0, event)
  token0Day.dailyVolumeToken = token0Day.dailyVolumeToken.plus(amount0Total)
  token0Day.dailyVolumeUSD = token0Day.dailyVolumeUSD.plus(amountUSD)
  token0Day.dailyVolumeETH = token0Day.dailyVolumeETH.plus(bundle.ethPrice.notEqual(ZERO_BD) ? amountUSD.div(bundle.ethPrice) : ZERO_BD)
  token0Day.dailyTxns = token0Day.dailyTxns.plus(ONE_BI)
  token0Day.save()

  let token1Day = updateTokenDayData(token1, event)
  token1Day.dailyVolumeToken = token1Day.dailyVolumeToken.plus(amount1Total)
  token1Day.dailyVolumeUSD = token1Day.dailyVolumeUSD.plus(amountUSD)
  token1Day.dailyVolumeETH = token1Day.dailyVolumeETH.plus(bundle.ethPrice.notEqual(ZERO_BD) ? amountUSD.div(bundle.ethPrice) : ZERO_BD)
  token1Day.dailyTxns = token1Day.dailyTxns.plus(ONE_BI)
  token1Day.save()

  let token0Hour = updateTokenHourData(token0, event)
  token0Hour.hourlyVolumeToken = token0Hour.hourlyVolumeToken.plus(amount0Total)
  token0Hour.hourlyVolumeUSD = token0Hour.hourlyVolumeUSD.plus(amountUSD)
  token0Hour.hourlyVolumeETH = token0Hour.hourlyVolumeETH.plus(bundle.ethPrice.notEqual(ZERO_BD) ? amountUSD.div(bundle.ethPrice) : ZERO_BD)
  token0Hour.hourlyTxns = token0Hour.hourlyTxns.plus(ONE_BI)
  token0Hour.save()

  let token1Hour = updateTokenHourData(token1, event)
  token1Hour.hourlyVolumeToken = token1Hour.hourlyVolumeToken.plus(amount1Total)
  token1Hour.hourlyVolumeUSD = token1Hour.hourlyVolumeUSD.plus(amountUSD)
  token1Hour.hourlyVolumeETH = token1Hour.hourlyVolumeETH.plus(bundle.ethPrice.notEqual(ZERO_BD) ? amountUSD.div(bundle.ethPrice) : ZERO_BD)
  token1Hour.hourlyTxns = token1Hour.hourlyTxns.plus(ONE_BI)
  token1Hour.save()

  let factoryDay = updateFactoryDayData(event)
  factoryDay.dailyVolumeUSD = factoryDay.dailyVolumeUSD.plus(amountUSD)
  factoryDay.dailyVolumeETH = factoryDay.dailyVolumeETH.plus(bundle.ethPrice.notEqual(ZERO_BD) ? amountUSD.div(bundle.ethPrice) : ZERO_BD)
  factoryDay.dailyTxns = factoryDay.dailyTxns.plus(ONE_BI)
  factoryDay.save()
}

export function handleSync(event: SyncEvent): void {
  let pair = getPair(event.address)
  if (pair === null) return
  let token0 = getToken(Address.fromString(pair.token0))
  let token1 = getToken(Address.fromString(pair.token1))

  let previousReserve0 = pair.reserve0
  let previousReserve1 = pair.reserve1
  let previousReserveUSD = pair.reserveUSD

  let reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals)
  let reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals)

  pair.reserve0 = reserve0
  pair.reserve1 = reserve1

  if (reserve0.notEqual(ZERO_BD) && reserve1.notEqual(ZERO_BD)) {
    pair.token0Price = reserve1.div(reserve0)
    pair.token1Price = reserve0.div(reserve1)
  } else {
    pair.token0Price = ZERO_BD
    pair.token1Price = ZERO_BD
  }

  updateTokenPrices(token0, token1)

  let trackedLiquidityUSD = getTrackedLiquidityUSD(token0, token1, reserve0, reserve1)
  let bundle = getBundle()
  let totalLiquidityUSD = reserve0
    .times(token0.derivedETH.times(bundle.ethPrice))
    .plus(reserve1.times(token1.derivedETH.times(bundle.ethPrice)))

  pair.trackedReserveUSD = trackedLiquidityUSD
  pair.reserveUSD = totalLiquidityUSD
  pair.reserveETH = bundle.ethPrice.notEqual(ZERO_BD) ? totalLiquidityUSD.div(bundle.ethPrice) : ZERO_BD
  pair.trackedReserveETH = bundle.ethPrice.notEqual(ZERO_BD) ? trackedLiquidityUSD.div(bundle.ethPrice) : ZERO_BD
  pair.save()

  token0.totalLiquidity = token0.totalLiquidity.minus(previousReserve0).plus(reserve0)
  token1.totalLiquidity = token1.totalLiquidity.minus(previousReserve1).plus(reserve1)
  token0.save()
  token1.save()

  let factory = getFactory()
  factory.totalLiquidityUSD = factory.totalLiquidityUSD.minus(previousReserveUSD).plus(totalLiquidityUSD)
  factory.totalLiquidityETH = bundle.ethPrice.notEqual(ZERO_BD) ? factory.totalLiquidityUSD.div(bundle.ethPrice) : ZERO_BD
  factory.save()
}
