import { AbiCoder, getAddress, keccak256, parseUnits, solidityPacked, toUtf8Bytes } from 'ethers'
import { mine, time } from '@nomicfoundation/hardhat-network-helpers'

const abiCoder = AbiCoder.defaultAbiCoder()

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

export function expandTo18Decimals(n: number): bigint {
  return parseUnits(String(n), 18)
}

function getDomainSeparator(name: string, tokenAddress: string) {
  return keccak256(
    abiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes('1')),
        1,
        tokenAddress
      ]
    )
  )
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    keccak256(solidityPacked(['address', 'address'], [token0, token1])),
    keccak256(bytecode)
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
}

export async function getApprovalDigest(
  token: any,
  approve: {
    owner: string
    spender: string
    value: bigint
  },
  nonce: bigint,
  deadline: bigint
): Promise<string> {
  const name = await token.name()
  const tokenAddress = await token.getAddress()
  const DOMAIN_SEPARATOR = getDomainSeparator(name, tokenAddress)
  return keccak256(
    solidityPacked(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          abiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        )
      ]
    )
  )
}

export async function mineBlock(timestamp: number): Promise<void> {
  await time.setNextBlockTimestamp(timestamp)
  await mine()
}

const Q112 = 1n << 112n

export function encodePrice(reserve0: bigint, reserve1: bigint) {
  return [reserve1 * Q112 / reserve0, reserve0 * Q112 / reserve1]
}
