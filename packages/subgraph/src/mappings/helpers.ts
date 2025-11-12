import {
  Address,
  BigDecimal,
  BigInt,
  dataSource,
  ethereum,
  log
} from '@graphprotocol/graph-ts'
import {
  Bundle,
  LiquidityPosition,
  LiquidityPositionSnapshot,
  Mint,
  Pair,
  PairDayData,
  PairHourData,
  Swap,
  Token,
  TokenDayData,
  TokenHourData,
  Transaction,
  WarpDayData,
  WarpFactoryStats
} from '../../generated/schema'
import { ERC20 } from '../../generated/WarpFactory/ERC20'
import { WarpFactory as FactoryContract } from '../../generated/WarpFactory/WarpFactory'
import { MINIMUM_ETH_LOCKED, USD_TOKENS, WHITELIST_TOKENS, WMegaETH_ADDRESS, ZERO_BD, ZERO_BI, BUNDLE_ID, FACTORY_ADDRESS, ONE_BD } from './constants'

export function createTransaction(event: ethereum.Event): Transaction {
  let id = event.transaction.hash.toHexString()
  let transaction = Transaction.load(id)
  if (transaction === null) {
    transaction = new Transaction(id)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
    transaction.mints = []
    transaction.burns = []
    transaction.swaps = []
    transaction.save()
  }
  return transaction
}

export function convertTokenToDecimal(amount: BigInt, decimals: BigInt): BigDecimal {
  if (decimals.equals(ZERO_BI)) {
    return amount.toBigDecimal()
  }
  let precision = BigInt.fromI32(10).pow(decimals.toI32() as u8).toBigDecimal()
  return amount.toBigDecimal().div(precision)
}

export function getFactory(): WarpFactoryStats {
  let id = FACTORY_ADDRESS.toHexString()
  let factory = WarpFactoryStats.load(id)
  if (factory === null) {
    factory = new WarpFactoryStats(id)
    factory.pairCount = ZERO_BI
    factory.totalVolumeETH = ZERO_BD
    factory.totalVolumeUSD = ZERO_BD
    factory.totalLiquidityETH = ZERO_BD
    factory.totalLiquidityUSD = ZERO_BD
    factory.txCount = ZERO_BI
    factory.save()
  }
  return factory
}

export function getBundle(): Bundle {
  let bundle = Bundle.load(BUNDLE_ID)
  if (bundle === null) {
    bundle = new Bundle(BUNDLE_ID)
    bundle.ethPrice = ONE_BD
    bundle.save()
  }
  return bundle
}

export function getToken(tokenAddress: Address): Token {
  let id = tokenAddress.toHexString()
  let token = Token.load(id)
  if (token === null) {
    token = new Token(id)
    token.symbol = ''
    token.name = ''
    token.decimals = ZERO_BI
    token.totalSupply = ZERO_BI
    token.derivedETH = ZERO_BD
    token.derivedUSD = ZERO_BD
    token.totalLiquidity = ZERO_BD
    token.volume = ZERO_BD
    token.volumeUSD = ZERO_BD
    token.volumeETH = ZERO_BD
    token.untrackedVolumeUSD = ZERO_BD
    token.txCount = ZERO_BI

    let contract = ERC20.bind(tokenAddress)
    let symbolResult = contract.try_symbol()
    if (!symbolResult.reverted) token.symbol = symbolResult.value
    let nameResult = contract.try_name()
    if (!nameResult.reverted) token.name = nameResult.value
    let decimalsResult = contract.try_decimals()
    if (!decimalsResult.reverted) token.decimals = BigInt.fromI32(decimalsResult.value)
    let supplyResult = contract.try_totalSupply()
    if (!supplyResult.reverted) token.totalSupply = supplyResult.value

    token.save()
  }
  return token
}

export function getPair(pairAddress: Address): Pair | null {
  return Pair.load(pairAddress.toHexString())
}

export function isWhitelistToken(address: Address): boolean {
  let hex = address.toHexString()
  for (let i = 0; i < WHITELIST_TOKENS.length; i++) {
    if (WHITELIST_TOKENS[i].toHexString() == hex) {
      return true
    }
  }
  return false
}

export function getLiquidityPosition(pair: Pair, user: Address): LiquidityPosition {
  let id = pair.id.concat('-').concat(user.toHexString())
  let liq = LiquidityPosition.load(id)
  if (liq === null) {
    liq = new LiquidityPosition(id)
    liq.pair = pair.id
    liq.user = user
    liq.liquidityTokenBalance = ZERO_BD
    liq.save()
  }
  return liq
}

export function createLiquiditySnapshot(
  position: LiquidityPosition,
  event: ethereum.Event
): void {
  let timestamp = event.block.timestamp.toI32()
  let id = position.id.concat('-').concat(timestamp.toString())
  let snapshot = new LiquidityPositionSnapshot(id)
  snapshot.liquidityPosition = position.id
  snapshot.timestamp = timestamp
  snapshot.block = event.block.number.toI32()
  snapshot.user = position.user
  snapshot.pair = position.pair
  let pair = Pair.load(position.pair)
  if (pair !== null) {
    snapshot.token0PriceUSD = pair.token0Price.times(getBundle().ethPrice)
    snapshot.token1PriceUSD = pair.token1Price.times(getBundle().ethPrice)
    snapshot.reserve0 = pair.reserve0
    snapshot.reserve1 = pair.reserve1
    snapshot.reserveUSD = pair.reserveUSD
  } else {
    snapshot.token0PriceUSD = ZERO_BD
    snapshot.token1PriceUSD = ZERO_BD
    snapshot.reserve0 = ZERO_BD
    snapshot.reserve1 = ZERO_BD
    snapshot.reserveUSD = ZERO_BD
  }
  snapshot.liquidityTokenBalance = position.liquidityTokenBalance
  snapshot.save()
}

export function updatePairDayData(event: ethereum.Event): PairDayData {
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let pair = Pair.load(dataSource.address().toHexString())
  let id = dataSource.address().toHexString().concat('-').concat(dayID.toString())
  let dayData = PairDayData.load(id)
  if (dayData === null) {
    dayData = new PairDayData(id)
    dayData.date = dayStartTimestamp
    dayData.pair = pair ? pair.id : dataSource.address().toHexString()
    dayData.dailyVolumeToken0 = ZERO_BD
    dayData.dailyVolumeToken1 = ZERO_BD
    dayData.dailyVolumeUSD = ZERO_BD
    dayData.dailyTxns = ZERO_BI
    dayData.reserve0 = ZERO_BD
    dayData.reserve1 = ZERO_BD
    dayData.reserveUSD = ZERO_BD
  }
  if (pair !== null) {
    dayData.reserve0 = pair.reserve0
    dayData.reserve1 = pair.reserve1
    dayData.reserveUSD = pair.reserveUSD
  }
  dayData.save()
  return dayData
}

export function updatePairHourData(event: ethereum.Event): PairHourData {
  let timestamp = event.block.timestamp.toI32()
  let hourIndex = timestamp / 3600
  let hourStartUnix = hourIndex * 3600
  let pair = Pair.load(dataSource.address().toHexString())
  let id = dataSource.address().toHexString().concat('-').concat(hourIndex.toString())
  let hourData = PairHourData.load(id)
  if (hourData === null) {
    hourData = new PairHourData(id)
    hourData.periodStartUnix = hourStartUnix
    hourData.pair = pair ? pair.id : dataSource.address().toHexString()
    hourData.hourlyVolumeToken0 = ZERO_BD
    hourData.hourlyVolumeToken1 = ZERO_BD
    hourData.hourlyVolumeUSD = ZERO_BD
    hourData.hourlyTxns = ZERO_BI
    hourData.reserve0 = ZERO_BD
    hourData.reserve1 = ZERO_BD
    hourData.reserveUSD = ZERO_BD
  }
  if (pair !== null) {
    hourData.reserve0 = pair.reserve0
    hourData.reserve1 = pair.reserve1
    hourData.reserveUSD = pair.reserveUSD
  }
  hourData.save()
  return hourData
}

export function updateTokenDayData(token: Token, event: ethereum.Event): TokenDayData {
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let id = token.id.concat('-').concat(dayID.toString())
  let dayData = TokenDayData.load(id)
  if (dayData === null) {
    dayData = new TokenDayData(id)
    dayData.date = dayStartTimestamp
    dayData.token = token.id
    dayData.dailyVolumeToken = ZERO_BD
    dayData.dailyVolumeETH = ZERO_BD
    dayData.dailyVolumeUSD = ZERO_BD
    dayData.dailyTxns = ZERO_BI
    dayData.priceUSD = ZERO_BD
    dayData.priceETH = ZERO_BD
    dayData.totalLiquidityToken = ZERO_BD
    dayData.totalLiquidityETH = ZERO_BD
    dayData.totalLiquidityUSD = ZERO_BD
  }
  dayData.priceETH = token.derivedETH
  dayData.priceUSD = token.derivedUSD
  dayData.totalLiquidityToken = token.totalLiquidity
  dayData.totalLiquidityETH = token.totalLiquidity.times(token.derivedETH)
  dayData.totalLiquidityUSD = dayData.totalLiquidityETH.times(getBundle().ethPrice)
  dayData.save()
  return dayData
}

export function updateTokenHourData(token: Token, event: ethereum.Event): TokenHourData {
  let timestamp = event.block.timestamp.toI32()
  let hourID = timestamp / 3600
  let hourStartUnix = hourID * 3600
  let id = token.id.concat('-').concat(hourID.toString())
  let hourData = TokenHourData.load(id)
  if (hourData === null) {
    hourData = new TokenHourData(id)
    hourData.periodStartUnix = hourStartUnix
    hourData.token = token.id
    hourData.hourlyVolumeToken = ZERO_BD
    hourData.hourlyVolumeETH = ZERO_BD
    hourData.hourlyVolumeUSD = ZERO_BD
    hourData.hourlyTxns = ZERO_BI
    hourData.priceUSD = ZERO_BD
    hourData.priceETH = ZERO_BD
  }
  hourData.priceETH = token.derivedETH
  hourData.priceUSD = token.derivedUSD
  hourData.save()
  return hourData
}

export function updateFactoryDayData(event: ethereum.Event): WarpDayData {
  let factory = getFactory()
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let id = dayID.toString()
  let dayData = WarpDayData.load(id)
  if (dayData === null) {
    dayData = new WarpDayData(id)
    dayData.date = dayStartTimestamp
    dayData.factory = factory.id
    dayData.dailyVolumeETH = ZERO_BD
    dayData.dailyVolumeUSD = ZERO_BD
    dayData.dailyTxns = ZERO_BI
    dayData.totalLiquidityETH = ZERO_BD
    dayData.totalLiquidityUSD = ZERO_BD
  }
  dayData.totalLiquidityETH = factory.totalLiquidityETH
  dayData.totalLiquidityUSD = factory.totalLiquidityUSD
  dayData.save()
  return dayData
}

function getPairAddress(tokenA: Address, tokenB: Address): Address | null {
  let factory = FactoryContract.bind(FACTORY_ADDRESS)
  let pairResult = factory.try_getPair(tokenA, tokenB)
  if (pairResult.reverted) {
    return null
  }
  if (pairResult.value.equals(Address.zero())) {
    return null
  }
  return pairResult.value
}

export function findETHPerToken(token: Token): BigDecimal {
  if (token.id == WMegaETH_ADDRESS.toHexString()) {
    return ONE_BD
  }
  let tokenAddress = Address.fromString(token.id)
  let pairAddress = getPairAddress(tokenAddress, WMegaETH_ADDRESS)
  if (pairAddress === null) {
    return ZERO_BD
  }
  let pair = Pair.load(pairAddress.toHexString())
  if (pair === null || pair.reserve0.equals(ZERO_BD) || pair.reserve1.equals(ZERO_BD)) {
    return ZERO_BD
  }
  if (pair.token0 == token.id) {
    return pair.reserve1.div(pair.reserve0)
  } else {
    return pair.reserve0.div(pair.reserve1)
  }
}

export function getETHPriceInUSD(): BigDecimal {
  // Note: USD values in the subgraph are not used by the frontend.
  // The frontend fetches real-time USD prices from GTE API and calculates TVL client-side.
  // Return ONE_BD (1.0) to avoid division-by-zero in calculations that derive ETH amounts from USD.
  // This gives a 1:1 placeholder ratio. Frontend ignores these values anyway.
  return ONE_BD
}

export function getTrackedVolumeUSD(
  token0: Token,
  token1: Token,
  amount0: BigDecimal,
  amount1: BigDecimal
): BigDecimal {
  let bundle = getBundle()
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)
  let bothWhitelisted = isWhitelistToken(Address.fromString(token0.id)) && isWhitelistToken(Address.fromString(token1.id))

  if (bothWhitelisted) {
    return amount0.times(price0).plus(amount1.times(price1)).div(BigDecimal.fromString('2'))
  }
  if (isWhitelistToken(Address.fromString(token0.id)) && !isWhitelistToken(Address.fromString(token1.id))) {
    return amount0.times(price0)
  }
  if (!isWhitelistToken(Address.fromString(token0.id)) && isWhitelistToken(Address.fromString(token1.id))) {
    return amount1.times(price1)
  }
  return ZERO_BD
}

export function getTrackedLiquidityUSD(
  token0: Token,
  token1: Token,
  reserve0: BigDecimal,
  reserve1: BigDecimal
): BigDecimal {
  let bundle = getBundle()
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)
  if (isWhitelistToken(Address.fromString(token0.id)) && isWhitelistToken(Address.fromString(token1.id))) {
    return reserve0.times(price0).plus(reserve1.times(price1))
  }
  if (isWhitelistToken(Address.fromString(token0.id)) && !isWhitelistToken(Address.fromString(token1.id))) {
    return reserve0.times(price0).times(BigDecimal.fromString('2'))
  }
  if (!isWhitelistToken(Address.fromString(token0.id)) && isWhitelistToken(Address.fromString(token1.id))) {
    return reserve1.times(price1).times(BigDecimal.fromString('2'))
  }
  return ZERO_BD
}

export function saveMint(event: ethereum.Event, pair: Pair): Mint {
  let transaction = createTransaction(event)
  let mintId = transaction.id.concat('-mint-').concat(event.logIndex.toString())
  let mint = new Mint(mintId)
  mint.pair = pair.id
  mint.to = event.transaction.to
  mint.timestamp = event.block.timestamp
  mint.transaction = transaction.id
  mint.liquidity = ZERO_BD
  mint.amount0 = ZERO_BD
  mint.amount1 = ZERO_BD
  mint.logIndex = event.logIndex

  let mints = transaction.mints
  mints.push(mint.id)
  transaction.mints = mints
  transaction.save()
  mint.save()
  return mint
}

export function valueInUSD(token: Token, amount: BigDecimal): BigDecimal {
  return amount.times(token.derivedETH).times(getBundle().ethPrice)
}

export function updateTokenPrices(token0: Token, token1: Token): void {
  token0.derivedETH = findETHPerToken(token0)
  token1.derivedETH = findETHPerToken(token1)
  let bundle = getBundle()
  token0.derivedUSD = token0.derivedETH.times(bundle.ethPrice)
  token1.derivedUSD = token1.derivedETH.times(bundle.ethPrice)
  token0.save()
  token1.save()
}
