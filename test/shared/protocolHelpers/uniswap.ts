import {DEADLINE, V2_INIT_CODE_HASH} from '../constants'
import { ethers } from 'ethers'
import { utils as zkUtils } from 'zksync-web3'
import bn from 'bignumber.js'
import { BigNumber, BigNumberish } from 'ethers'
import {Contract} from "@ethersproject/contracts";
import * as PAIR_V2_ARTIFACT from "@uniswap/v2-core/artifacts-zk/contracts/UniswapV2Pair.sol/UniswapV2Pair.json";
import {getWallets} from "../zkSyncUtils";
import {FeeAmount, TICK_SPACINGS} from "@uniswap/v3-sdk";

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

export async function createPairAndMintUniswapV2(
    v2Factory: Contract,
    token0: Contract,
    token1: Contract,
    amount0: BigNumber,
    amount1: BigNumber
) {
    await v2Factory.createPair(token0.address, token1.address)
    const pairAddress = await v2Factory.getPair(token0.address, token1.address)
    const pair = new ethers.Contract(pairAddress, PAIR_V2_ARTIFACT.abi, getWallets()[0])
    await token0.transfer(pairAddress, amount0)
    await token1.transfer(pairAddress, amount1)
    await pair.mint(getWallets()[0].address)
}

export async function createPoolAndMintUniswapV3(
    nftManager: Contract,
    token0: Contract,
    token1: Contract,
    amount0: BigNumber,
    amount1: BigNumber,
    fee: FeeAmount
) {
    if (!isTokenOrderCorrect(token0, token1)) {
        [token0, token1] = [token1, token0];
        [amount0, amount1] = [amount1, amount0]
    }
    await nftManager.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        fee,
        encodePriceSqrt(amount1, amount0)
    )

    // The liquidity is provided for the whole range. Shouldn't affect the tests, since swap amounts are not big
    const tickLower = Math.ceil(-887272 / TICK_SPACINGS[fee]) * TICK_SPACINGS[fee]
    const tickUpper = Math.floor(887272 / TICK_SPACINGS[fee]) * TICK_SPACINGS[fee]

    const liquidityParams = {
        token0: token0.address,
        token1: token1.address,
        fee,
        tickLower,
        tickUpper,
        recipient: getWallets()[0].address,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: 0,
        amount1Min: 0,
        deadline: DEADLINE,
    }
    await token0.approve(nftManager.address, amount0)
    await token1.approve(nftManager.address, amount1)
    await nftManager.mint(liquidityParams)
}

export function computePairAddress(factoryAddress: string, tokenA: string, tokenB: string): string {
    const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
    const constructorArgumentsEncoded = ethers.utils.solidityPack(['address', 'address'], [token0, token1])
    return zkUtils.create2Address(
        factoryAddress,
        V2_INIT_CODE_HASH,
        ethers.utils.keccak256(constructorArgumentsEncoded),
        '0x'
    )
}

export function isTokenOrderCorrect(first: Contract, second: Contract): boolean {
    return first.address.toLowerCase() < second.address.toLowerCase()
}

// returns the sqrt price as a 64x96
function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
    return BigNumber.from(
        new bn(reserve1.toString())
            .div(reserve0.toString())
            .sqrt()
            .multipliedBy(new bn(2).pow(96))
            .integerValue(3)
            .toString()
    )
}
