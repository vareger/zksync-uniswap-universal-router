import { V2_INIT_CODE_HASH } from './constants'
import { ethers } from 'ethers'
import { utils } from 'zksync-web3'

export function computeV2PairAddress(factoryAddress: string, [tokenA, tokenB]: [string, string]): string {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
  const constructorArgumentsEncoded = ethers.utils.solidityPack(['address', 'address'], [token0, token1])
  return utils.create2Address(
    factoryAddress,
    V2_INIT_CODE_HASH,
    ethers.utils.keccak256(constructorArgumentsEncoded),
    '0x'
  )
}
