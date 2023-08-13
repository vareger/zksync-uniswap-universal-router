import JSBI from 'jsbi'
import {BigintIsh, CurrencyAmount, Token} from '@uniswap/sdk-core'
import {Pair} from '@uniswap/v2-sdk'
import {encodeSqrtRatioX96, FeeAmount, nearestUsableTick, Pool, TickMath, TICK_SPACINGS} from '@uniswap/v3-sdk'
import { abi as V2_PAIR_ABI } from '../../../../artifacts-zk/@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json'
import {BigNumber, ethers} from 'ethers'
import {Wallet} from "zksync-web3";

const feeAmount = FeeAmount.MEDIUM
const sqrtRatioX96 = encodeSqrtRatioX96(1, 1)
const liquidity = 1_000_000

// v3
export const makePool = (token0: Token, token1: Token, liquidity: number) => {
    return new Pool(token0, token1, feeAmount, sqrtRatioX96, liquidity, TickMath.getTickAtSqrtRatio(sqrtRatioX96), [
        {
            index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
            liquidityNet: liquidity,
            liquidityGross: liquidity,
        },
        {
            index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
            liquidityNet: -liquidity,
            liquidityGross: liquidity,
        },
    ])
}

export function pool_DAI_WETH(DAI: Token, WETH: Token): Pool {
    return makePool(DAI, WETH, liquidity)
}

export function pool_DAI_USDC(USDC: Token, DAI: Token): Pool {
    return makePool(USDC, DAI, liquidity)
}

export function pool_USDC_WETH(USDC: Token, WETH: Token): Pool {
    return makePool(USDC, WETH, liquidity)
}

export function pool_USDC_USDT(USDC: Token, USDT: Token): Pool {
    return makePool(USDC, USDT, liquidity)
}

export function pool_WETH_USDT(WETH: Token, USDT: Token): Pool {
    return makePool(USDT, WETH, liquidity)
}

type Reserves = {
    reserve0: BigNumber
    reserve1: BigNumber
}
export const getV2PoolReserves = async (alice: Wallet, tokenA: Token, tokenB: Token): Promise<Reserves> => {
    const contractAddress = Pair.getAddress(tokenA, tokenB)
    const contract = new ethers.Contract(contractAddress, V2_PAIR_ABI, alice)

    const { reserve0, reserve1 } = await contract.getReserves()
    return { reserve0, reserve1 }
}

// v2
export const makePair = async (alice: Wallet, token0: Token, token1: Token) => {
    const reserves = await getV2PoolReserves(alice, token0, token1)
    let reserve0: CurrencyAmount<Token> = CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(reserves.reserve0))
    let reserve1: CurrencyAmount<Token> = CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(reserves.reserve1))

    return new Pair(reserve0, reserve1)
}

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
