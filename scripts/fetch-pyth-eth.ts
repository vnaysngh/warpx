import { ethers } from 'ethers'

const PYTH_CONTRACT = '0x2880aB155794e7179c9eE2e38200202908C17B43'
const ETH_USD_ID = '0xca80ba6dc32e08d122fd8f5d94c7d39878c1b0f4fd769bcdb52b349c8b8d36b9'

const abi = [
  'function getPrice(bytes32 id) view returns (int64 price, uint64 conf, int32 expo, uint publishTime)'
]

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.MEGAETH_RPC_URL || 'https://carrot.megaeth.com/rpc')
  const pyth = new ethers.Contract(PYTH_CONTRACT, abi, provider)
  const [price, conf, expo, publishTime] = await pyth.getPrice(ETH_USD_ID)
  const normalized = Number(price) * Math.pow(10, Number(expo))
  const confValue = Number(conf) * Math.pow(10, Number(expo))
  console.log('Raw price:', price.toString())
  console.log('Exponent:', expo.toString())
  console.log('Normalized price:', normalized)
  console.log('Confidence interval:', confValue)
  console.log('Publish time:', publishTime.toString())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
