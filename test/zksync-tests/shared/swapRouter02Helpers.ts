import JSBI from 'jsbi'
import { BigintIsh } from '@uniswap/sdk-core'
import { FeeAmount } from '@uniswap/v3-sdk'
// import { WETH, DAI, USDC, USDT } from './mainnetForkHelpers'
import { BigNumber } from 'ethers'

// v3
// export const makePool = (token0: Token, token1: Token, liquidity: number) => {
//   return new Pool(token0, token1, feeAmount, sqrtRatioX96, liquidity, TickMath.getTickAtSqrtRatio(sqrtRatioX96), [
//     {
//       index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
//       liquidityNet: liquidity,
//       liquidityGross: liquidity,
//     },
//     {
//       index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
//       liquidityNet: -liquidity,
//       liquidityGross: liquidity,
//     },
//   ])
// }

// export const pool_DAI_WETH = makePool(DAI, WETH, liquidity)
// export const pool_DAI_USDC = makePool(USDC, DAI, liquidity)
// export const pool_USDC_WETH = makePool(USDC, WETH, liquidity)
// export const pool_USDC_USDT = makePool(USDC, USDT, liquidity)
// export const pool_WETH_USDT = makePool(USDT, WETH, liquidity)

const FEE_SIZE = 3

// v3
export function encodePath(path: string[], fees: FeeAmount[]): string {
  if (path.length != fees.length + 1) {
    throw new Error('path/fee lengths do not match')
  }

  let encoded = '0x'
  for (let i = 0; i < fees.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2)
    // 3 byte encoding of the fee
    encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0')
  }
  // encode the final token
  encoded += path[path.length - 1].slice(2)

  return encoded.toLowerCase()
}

export function expandTo18Decimals(n: number): BigintIsh {
  return JSBI.BigInt(BigNumber.from(n).mul(BigNumber.from(10).pow(18)).toString())
}
