import type { Contract } from '@ethersproject/contracts'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { FeeAmount } from '@uniswap/v3-sdk'
import { parseEvents, V2_EVENTS, V3_EVENTS } from './shared/parseEvents'
import { expect } from 'chai'
import { encodePath } from './shared/swapRouter02Helpers'
import { BigNumber, BigNumberish } from 'ethers'
import { Permit2, UniversalRouter } from '../typechain'
import {
  ADDRESS_THIS,
  CONTRACT_BALANCE,
  DEADLINE,
  ETH_ADDRESS,
  MAX_UINT,
  MAX_UINT160,
  MSG_SENDER,
  ONE_PERCENT_BIPS,
  SOURCE_MSG_SENDER,
  SOURCE_ROUTER,
} from './shared/constants'
import { expandTo18DecimalsBN } from './shared/helpers'
import deployUniversalRouter, {
  deployNftManager,
  deployPermit2,
  deployV2Factory,
  deployV3Factory,
  deployWeth,
} from './shared/deployUniversalRouter'
import { RoutePlanner, CommandType } from './shared/planner'
import hre from 'hardhat'
import { getPermitSignature, getPermitBatchSignature, PermitSingle } from './shared/protocolHelpers/permit2'
const { ethers } = hre
import { deployContract, getWallets } from './shared/zkSyncUtils'
import { Wallet } from 'zksync-web3'
import { abi as safeCastAbi } from '../artifacts-zk/permit2/src/libraries/SafeCast160.sol/SafeCast160.json'
import { createPairAndMintUniswapV2, createPoolAndMintUniswapV3, isTokenOrderCorrect, computePairAddress } from "./shared/protocolHelpers/uniswap";

describe('Uniswap V2 and V3 Tests:', () => {
  let alice: Wallet
  let bob: Wallet
  let router: UniversalRouter
  let permit2: Permit2
  let daiContract: Contract
  let wethContract: Contract
  let usdcContract: Contract
  let usdtContract: Contract
  let v2Factory: Contract
  let planner: RoutePlanner

  beforeEach(async () => {
    alice = getWallets()[0]
    bob = getWallets()[1]
    daiContract = await deployContract('MintableERC20', [18, BigNumber.from(10).pow(30)])
    wethContract = await deployWeth()
    await wethContract.deposit({ value: ethers.utils.parseEther('100000') })
    usdcContract = await deployContract('MintableERC20', [6, BigNumber.from(10).pow(30)])
    usdtContract = await deployContract('MintableERC20', [6, BigNumber.from(10).pow(30)])
    permit2 = (await deployPermit2()).connect(bob) as Permit2

    v2Factory = await deployV2Factory()
    const v3Factory = await deployV3Factory()
    const nftManager = await deployNftManager(v3Factory.address, wethContract.address)

    // v2 liquidity amounts from the original tests
    await createPairAndMintUniswapV2(
      v2Factory,
      daiContract,
      wethContract,
      BigNumber.from('8140529658966941313012915'),
      BigNumber.from('4430761666523311112725')
    )
    await createPairAndMintUniswapV2(
      v2Factory,
      daiContract,
      usdcContract,
      BigNumber.from('60144550130643463746539502'),
      BigNumber.from('60116888330202')
    )
    await createPairAndMintUniswapV2(
      v2Factory,
      wethContract,
      usdcContract,
      BigNumber.from('33787846973815924916236'),
      BigNumber.from('62122035788372')
    )

    await createPairAndMintUniswapV2(
      v2Factory,
      daiContract,
      usdtContract,
      BigNumber.from('3412637957762525698494106'),
      BigNumber.from('3408522124913')
    )
    await createPairAndMintUniswapV2(
      v2Factory,
      wethContract,
      usdtContract,
      BigNumber.from('9542318191272319666383'),
      BigNumber.from('17559860761679')
    )

    // v3 liquidity amounts the same as for v2, price should be roughly the same
    await createPoolAndMintUniswapV3(
      nftManager,
      daiContract,
      wethContract,
      BigNumber.from('8140529658966941313012915'),
      BigNumber.from('4430761666523311112725'),
      FeeAmount.MEDIUM,
    )
    await createPoolAndMintUniswapV3(
      nftManager,
      daiContract,
      usdcContract,
      BigNumber.from('60144550130643463746539502'),
      BigNumber.from('60116888330202'),
      FeeAmount.MEDIUM,
    )
    await createPoolAndMintUniswapV3(
      nftManager,
      wethContract,
      usdcContract,
      BigNumber.from('33787846973815924916236'),
      BigNumber.from('62122035788372'),
      FeeAmount.MEDIUM
    )

    router = (
      await deployUniversalRouter(
        permit2,
        undefined,
        undefined,
        undefined,
        wethContract.address,
        v2Factory.address,
        v3Factory.address
      )
    ).connect(bob) as UniversalRouter
    planner = new RoutePlanner()

    // alice gives bob some tokens
    await daiContract.connect(alice).transfer(bob.address, expandTo18DecimalsBN(100000))
    await wethContract.connect(alice).transfer(bob.address, expandTo18DecimalsBN(100))

    // Bob max-approves the permit2 contract to access his DAI and WETH
    await daiContract.connect(bob).approve(permit2.address, MAX_UINT)
    await wethContract.connect(bob).approve(permit2.address, MAX_UINT)
  })

  describe('Trade on Uniswap with Permit2, giving approval every time', () => {
    describe('ERC20 --> ERC20', () => {
      let permit: PermitSingle

      it('V2 exactIn, permiting the exact amount', async () => {
        const amountInDAI = expandTo18DecimalsBN(100)
        const minAmountOutWETH = expandTo18DecimalsBN(0.03)

        // second bob signs a permit to allow the router to access his DAI
        permit = {
          details: {
            token: daiContract.address,
            amount: amountInDAI,
            expiration: 0, // expiration of 0 is block.timestamp
            nonce: 0, // this is his first trade
          },
          spender: router.address,
          sigDeadline: DEADLINE,
        }
        const sig = await getPermitSignature(permit, bob, permit2)

        // 1) permit the router to access funds, 2) withdraw the funds into the pair, 3) trade
        planner.addCommand(CommandType.PERMIT2_PERMIT, [permit, sig])
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          MSG_SENDER,
          amountInDAI,
          minAmountOutWETH,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        const { wethBalanceBefore, wethBalanceAfter, daiBalanceAfter, daiBalanceBefore } = await executeRouter(planner)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gte(minAmountOutWETH)
        expect(daiBalanceBefore.sub(daiBalanceAfter)).to.be.eq(amountInDAI)
      })

      it('V2 exactOut, permiting the maxAmountIn', async () => {
        const maxAmountInDAI = expandTo18DecimalsBN(3000)
        const amountOutWETH = expandTo18DecimalsBN(1)

        // second bob signs a permit to allow the router to access his DAI
        permit = {
          details: {
            token: daiContract.address,
            amount: maxAmountInDAI,
            expiration: 0, // expiration of 0 is block.timestamp
            nonce: 0, // this is his first trade
          },
          spender: router.address,
          sigDeadline: DEADLINE,
        }
        const sig = await getPermitSignature(permit, bob, permit2)

        // 1) permit the router to access funds, 2) trade - the transfer happens within the trade for exactOut
        planner.addCommand(CommandType.PERMIT2_PERMIT, [permit, sig])
        planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
          MSG_SENDER,
          amountOutWETH,
          maxAmountInDAI,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        const { wethBalanceBefore, wethBalanceAfter, daiBalanceAfter, daiBalanceBefore } = await executeRouter(planner)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.eq(amountOutWETH)
        expect(daiBalanceBefore.sub(daiBalanceAfter)).to.be.lte(maxAmountInDAI)
      })

      it('V2 exactIn, swapping more than max_uint160 should revert', async () => {
        const max_uint = BigNumber.from(MAX_UINT160)
        const minAmountOutWETH = expandTo18DecimalsBN(0.03)

        // second bob signs a permit to allow the router to access his DAI
        permit = {
          details: {
            token: daiContract.address,
            amount: max_uint,
            expiration: 0, // expiration of 0 is block.timestamp
            nonce: 0, // this is his first trade
          },
          spender: router.address,
          sigDeadline: DEADLINE,
        }
        const sig = await getPermitSignature(permit, bob, permit2)

        // 1) permit the router to access funds, 2) withdraw the funds into the pair, 3) trade
        planner.addCommand(CommandType.PERMIT2_PERMIT, [permit, sig])
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          MSG_SENDER,
          BigNumber.from(MAX_UINT160).add(1),
          minAmountOutWETH,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])

        const iface = new ethers.utils.Interface(safeCastAbi)
        await expect(executeRouter(planner)).to.be.revertedWithCustomError({ interface: iface }, 'UnsafeCast')
      })

      it('V3 exactIn, permiting the exact amount', async () => {
        const amountInDAI = expandTo18DecimalsBN(100)
        const minAmountOutWETH = expandTo18DecimalsBN(0.03)

        // first bob approves permit2 to access his DAI
        await daiContract.connect(bob).approve(permit2.address, MAX_UINT)

        // second bob signs a permit to allow the router to access his DAI
        permit = {
          details: {
            token: daiContract.address,
            amount: amountInDAI,
            expiration: 0, // expiration of 0 is block.timestamp
            nonce: 0, // this is his first trade
          },
          spender: router.address,
          sigDeadline: DEADLINE,
        }
        const sig = await getPermitSignature(permit, bob, permit2)

        const path = encodePathExactInput([daiContract.address, wethContract.address])

        // 1) permit the router to access funds, 2) trade, which takes the funds directly from permit2
        planner.addCommand(CommandType.PERMIT2_PERMIT, [permit, sig])
        planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
          MSG_SENDER,
          amountInDAI,
          minAmountOutWETH,
          path,
          SOURCE_MSG_SENDER,
        ])
        const { wethBalanceBefore, wethBalanceAfter, daiBalanceAfter, daiBalanceBefore } = await executeRouter(planner)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gte(minAmountOutWETH)
        expect(daiBalanceBefore.sub(daiBalanceAfter)).to.be.eq(amountInDAI)
      })

      it('V3 exactOut, permiting the exact amount', async () => {
        const maxAmountInDAI = expandTo18DecimalsBN(3000)
        const amountOutWETH = expandTo18DecimalsBN(1)

        // first bob approves permit2 to access his DAI
        await daiContract.connect(bob).approve(permit2.address, MAX_UINT)

        // second bob signs a permit to allow the router to access his DAI
        permit = {
          details: {
            token: daiContract.address,
            amount: maxAmountInDAI,
            expiration: 0, // expiration of 0 is block.timestamp
            nonce: 0, // this is his first trade
          },
          spender: router.address,
          sigDeadline: DEADLINE,
        }
        const sig = await getPermitSignature(permit, bob, permit2)

        const path = encodePathExactOutput([daiContract.address, wethContract.address])

        // 1) permit the router to access funds, 2) trade, which takes the funds directly from permit2
        planner.addCommand(CommandType.PERMIT2_PERMIT, [permit, sig])
        planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [
          MSG_SENDER,
          amountOutWETH,
          maxAmountInDAI,
          path,
          SOURCE_MSG_SENDER,
        ])
        const { wethBalanceBefore, wethBalanceAfter, daiBalanceAfter, daiBalanceBefore } = await executeRouter(planner)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.eq(amountOutWETH)
        expect(daiBalanceBefore.sub(daiBalanceAfter)).to.be.lte(maxAmountInDAI)
      })
    })
  })

  describe('Trade on UniswapV2', () => {
    const amountIn: BigNumber = expandTo18DecimalsBN(5)
    beforeEach(async () => {
      // for these tests Bob gives the router max approval on permit2
      await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)
      await permit2.approve(wethContract.address, router.address, MAX_UINT160, DEADLINE)
    })

    describe('ERC20 --> ERC20', () => {
      it('completes a V2 exactIn swap', async () => {
        const minAmountOut = expandTo18DecimalsBN(0.0001)
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          MSG_SENDER,
          amountIn,
          minAmountOut,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gt(minAmountOut)
      })

      it('completes a V2 exactOut swap', async () => {
        const amountOut = expandTo18DecimalsBN(1)
        planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
          MSG_SENDER,
          amountOut,
          expandTo18DecimalsBN(10000),
          [wethContract.address, daiContract.address],
          SOURCE_MSG_SENDER,
        ])
        planner.addCommand(CommandType.SWEEP, [wethContract.address, MSG_SENDER, 0])
        const { daiBalanceBefore, daiBalanceAfter } = await executeRouter(planner)
        expect(daiBalanceAfter.sub(daiBalanceBefore)).to.be.gt(amountOut)
      })

      it('exactIn trade, where an output fee is taken', async () => {
        // back to the router so someone can take a fee
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          router.address,
          amountIn,
          1,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        planner.addCommand(CommandType.PAY_PORTION, [wethContract.address, alice.address, ONE_PERCENT_BIPS])
        planner.addCommand(CommandType.SWEEP, [wethContract.address, MSG_SENDER, 1])

        const { commands, inputs } = planner
        const wethBalanceBeforeAlice = await wethContract.balanceOf(alice.address)
        const wethBalanceBeforeBob = await wethContract.balanceOf(bob.address)

        await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)

        const wethBalanceAfterAlice = await wethContract.balanceOf(alice.address)
        const wethBalanceAfterBob = await wethContract.balanceOf(bob.address)

        const aliceFee = wethBalanceAfterAlice.sub(wethBalanceBeforeAlice)
        const bobEarnings = wethBalanceAfterBob.sub(wethBalanceBeforeBob)

        expect(bobEarnings).to.be.gt(0)
        expect(aliceFee.add(bobEarnings).mul(ONE_PERCENT_BIPS).div(10_000)).to.eq(aliceFee)
      })

      it('completes a V2 exactIn swap with longer path', async () => {
        const minAmountOut = expandTo18DecimalsBN(0.0001)
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          MSG_SENDER,
          amountIn,
          minAmountOut,
          [daiContract.address, usdcContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])

        const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gt(minAmountOut)
      })
    })

    describe('ERC20 --> ETH', () => {
      it('completes a V2 exactIn swap', async () => {
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          router.address,
          amountIn,
          1,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0])

        const { gasSpent, ethBalanceBefore, ethBalanceAfter, v2SwapEventArgs } = await executeRouter(planner)
        const { amount0Out, amount1Out } = v2SwapEventArgs!
        const wethTraded = isTokenOrderCorrect(daiContract, wethContract) ? amount1Out : amount0Out

        expect(ethBalanceAfter.sub(ethBalanceBefore)).to.eq(wethTraded.sub(gasSpent))
      })

      it('completes a V2 exactOut swap', async () => {
        const amountOut = expandTo18DecimalsBN(1)
        planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
          router.address,
          amountOut,
          expandTo18DecimalsBN(10000),
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, amountOut])
        planner.addCommand(CommandType.SWEEP, [daiContract.address, MSG_SENDER, 0])

        const { gasSpent, ethBalanceBefore, ethBalanceAfter, v2SwapEventArgs } = await executeRouter(planner)
        const { amount0Out, amount1Out } = v2SwapEventArgs!
        const wethTraded = isTokenOrderCorrect(daiContract, wethContract) ? amount1Out : amount0Out
        expect(ethBalanceAfter.sub(ethBalanceBefore)).to.eq(amountOut.sub(gasSpent))
        expect(ethBalanceAfter.sub(ethBalanceBefore)).to.eq(wethTraded.sub(gasSpent))
      })

      it('completes a V2 exactOut swap, with ETH fee', async () => {
        const amountOut = expandTo18DecimalsBN(1)
        planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
          router.address,
          amountOut,
          expandTo18DecimalsBN(10000),
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        planner.addCommand(CommandType.UNWRAP_WETH, [router.address, amountOut])
        planner.addCommand(CommandType.PAY_PORTION, [ETH_ADDRESS, alice.address, ONE_PERCENT_BIPS])
        planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, MSG_SENDER, 0])

        const { commands, inputs } = planner
        const ethBalanceBeforeAlice = await ethers.provider.getBalance(alice.address)
        const ethBalanceBeforeBob = await ethers.provider.getBalance(bob.address)
        const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).wait()

        const ethBalanceAfterAlice = await ethers.provider.getBalance(alice.address)
        const ethBalanceAfterBob = await ethers.provider.getBalance(bob.address)
        const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)

        const aliceFee = ethBalanceAfterAlice.sub(ethBalanceBeforeAlice)
        const bobEarnings = ethBalanceAfterBob.sub(ethBalanceBeforeBob).add(gasSpent)

        expect(aliceFee.add(bobEarnings).mul(ONE_PERCENT_BIPS).div(10000)).to.eq(aliceFee)
      })
    })

    describe('ETH --> ERC20', () => {
      it('completes a V2 exactIn swap', async () => {
        const minAmountOut = expandTo18DecimalsBN(0.001)
        const pairAddress = computePairAddress(v2Factory.address, daiContract.address, wethContract.address)
        planner.addCommand(CommandType.WRAP_ETH, [pairAddress, amountIn])
        // amountIn of 0 because the weth is already in the pair
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          MSG_SENDER,
          0,
          minAmountOut,
          [wethContract.address, daiContract.address],
          SOURCE_MSG_SENDER,
        ])

        const { daiBalanceBefore, daiBalanceAfter, v2SwapEventArgs } = await executeRouter(planner, amountIn)
        const { amount0Out, amount1Out } = v2SwapEventArgs!
        const daiTraded = isTokenOrderCorrect(daiContract, wethContract) ? amount0Out : amount1Out

        expect(daiBalanceAfter.sub(daiBalanceBefore)).to.be.gt(minAmountOut)
        expect(daiBalanceAfter.sub(daiBalanceBefore)).to.equal(daiTraded)
      })

      it('completes a V2 exactOut swap', async () => {
        const amountOut = expandTo18DecimalsBN(100)
        const value = expandTo18DecimalsBN(1)

        planner.addCommand(CommandType.WRAP_ETH, [router.address, value])
        planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
          MSG_SENDER,
          amountOut,
          expandTo18DecimalsBN(1),
          [wethContract.address, daiContract.address],
          SOURCE_ROUTER,
        ])
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0])

        const { ethBalanceBefore, ethBalanceAfter, daiBalanceBefore, daiBalanceAfter, v2SwapEventArgs, gasSpent } =
          await executeRouter(planner, value)
        const { amount0Out, amount1Out, amount0In, amount1In } = v2SwapEventArgs!
        const daiTraded = isTokenOrderCorrect(daiContract, wethContract) ? amount0Out : amount1Out
        const wethTraded = isTokenOrderCorrect(daiContract, wethContract) ? amount1In : amount0In
        expect(daiBalanceAfter.sub(daiBalanceBefore)).gt(amountOut) // rounding
        expect(daiBalanceAfter.sub(daiBalanceBefore)).eq(daiTraded)
        expect(ethBalanceBefore.sub(ethBalanceAfter)).to.eq(wethTraded.add(gasSpent))
      })
    })
  })

  describe('Trade on UniswapV3', () => {
    const amountIn: BigNumber = expandTo18DecimalsBN(500)
    const amountInMax: BigNumber = expandTo18DecimalsBN(2000)
    const amountOut: BigNumber = expandTo18DecimalsBN(1)

    beforeEach(async () => {
      // for these tests Bob gives the router max approval on permit2
      await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)
      await permit2.approve(wethContract.address, router.address, MAX_UINT160, DEADLINE)
    })

    const addV3ExactInTrades = (
      planner: RoutePlanner,
      numTrades: BigNumberish,
      amountOutMin: BigNumberish,
      recipient?: string,
      tokens: string[] = [daiContract.address, wethContract.address],
      tokenSource: boolean = SOURCE_MSG_SENDER
    ) => {
      const path = encodePathExactInput(tokens)
      for (let i = 0; i < numTrades; i++) {
        planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
          recipient ?? MSG_SENDER,
          amountIn,
          amountOutMin,
          path,
          tokenSource,
        ])
      }
    }

    describe('ERC20 --> ERC20', () => {
      it('completes a V3 exactIn swap', async () => {
        const amountOutMin: BigNumber = expandTo18DecimalsBN(0.0005)
        addV3ExactInTrades(planner, 1, amountOutMin)

        const { wethBalanceBefore, wethBalanceAfter, v3SwapEventArgs } = await executeRouter(planner)
        const { amount0, amount1 } = v3SwapEventArgs!
        const wethTraded = isTokenOrderCorrect(daiContract, wethContract) ? amount1 : amount0
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gte(amountOutMin)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.eq(wethTraded.mul(-1))
      })

      it('completes a V3 exactIn swap with longer path', async () => {
        const amountOutMin: number = 3 * 10 ** 6
        addV3ExactInTrades(
          planner,
          1,
          amountOutMin,
          MSG_SENDER,
          [daiContract.address, wethContract.address, usdcContract.address],
          SOURCE_MSG_SENDER
        )

        const {
          daiBalanceBefore,
          daiBalanceAfter,
          wethBalanceBefore,
          wethBalanceAfter,
          usdcBalanceBefore,
          usdcBalanceAfter,
        } = await executeRouter(planner)

        expect(daiBalanceBefore.sub(amountIn)).to.eq(daiBalanceAfter)
        expect(wethBalanceAfter).to.eq(wethBalanceBefore)
        expect(usdcBalanceAfter.sub(usdcBalanceBefore)).to.be.gte(amountOutMin)
      })

      it('completes a V3 exactOut swap', async () => {
        // trade DAI in for WETH out
        const tokens = [daiContract.address, wethContract.address]
        const path = encodePathExactOutput(tokens)

        planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [MSG_SENDER, amountOut, amountInMax, path, SOURCE_MSG_SENDER])

        const { wethBalanceBefore, wethBalanceAfter, v3SwapEventArgs } = await executeRouter(planner)
        const { amount0, amount1 } = v3SwapEventArgs!
        const daiTraded = isTokenOrderCorrect(daiContract, wethContract) ? amount0 : amount1
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.eq(amountOut)
        expect(daiTraded).to.be.lt(amountInMax)
      })

      it('completes a V3 exactOut swap with longer path', async () => {
        // trade DAI in for WETH out
        const tokens = [daiContract.address, usdcContract.address, wethContract.address]
        const path = encodePathExactOutput(tokens)
        // for these tests Bob gives the router max approval on permit2
        // await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)

        planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [MSG_SENDER, amountOut, amountInMax, path, SOURCE_MSG_SENDER])
        const { commands, inputs } = planner

        const balanceWethBefore = await wethContract.balanceOf(bob.address)
        await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)
        const balanceWethAfter = await wethContract.balanceOf(bob.address)
        expect(balanceWethAfter.sub(balanceWethBefore)).to.eq(amountOut)
      })
    })

    describe('ERC20 --> ETH', () => {
      it('completes a V3 exactIn swap', async () => {
        const amountOutMin: BigNumber = expandTo18DecimalsBN(0.0005)
        addV3ExactInTrades(planner, 1, amountOutMin, router.address)
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0])

        const { ethBalanceBefore, ethBalanceAfter, v3SwapEventArgs, gasSpent } = await executeRouter(planner)
        const { amount0, amount1 } = v3SwapEventArgs!
        const wethTraded = isTokenOrderCorrect(daiContract, wethContract) ? amount1 : amount0

        expect(ethBalanceAfter.sub(ethBalanceBefore)).to.be.gte(amountOutMin.sub(gasSpent))
        expect(ethBalanceAfter.sub(ethBalanceBefore)).to.eq(wethTraded.mul(-1).sub(gasSpent))
      })

      it('completes a V3 exactOut swap', async () => {
        // trade DAI in for WETH out
        const tokens = [daiContract.address, wethContract.address]
        const path = encodePathExactOutput(tokens)

        planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [
          router.address,
          amountOut,
          amountInMax,
          path,
          SOURCE_MSG_SENDER,
        ])
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, amountOut])

        const { ethBalanceBefore, ethBalanceAfter, gasSpent } = await executeRouter(planner)

        expect(ethBalanceAfter.sub(ethBalanceBefore)).to.eq(amountOut.sub(gasSpent))
      })
    })

    describe('ETH --> ERC20', () => {
      it('completes a V3 exactIn swap', async () => {
        const tokens = [wethContract.address, daiContract.address]
        const amountOutMin: BigNumber = expandTo18DecimalsBN(0.0005)

        planner.addCommand(CommandType.WRAP_ETH, [router.address, amountIn])
        addV3ExactInTrades(planner, 1, amountOutMin, MSG_SENDER, tokens, SOURCE_ROUTER)

        const { ethBalanceBefore, ethBalanceAfter, daiBalanceBefore, daiBalanceAfter, gasSpent } = await executeRouter(
          planner,
          amountIn
        )

        expect(ethBalanceBefore.sub(ethBalanceAfter)).to.eq(amountIn.add(gasSpent))
        expect(daiBalanceAfter.sub(daiBalanceBefore)).to.be.gte(amountOutMin)
      })

      it('completes a V3 exactOut swap', async () => {
        const tokens = [wethContract.address, daiContract.address]
        const path = encodePathExactOutput(tokens)

        planner.addCommand(CommandType.WRAP_ETH, [router.address, amountInMax])
        planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [MSG_SENDER, amountOut, amountInMax, path, SOURCE_ROUTER])
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0])

        const { ethBalanceBefore, ethBalanceAfter, daiBalanceBefore, daiBalanceAfter, gasSpent, v3SwapEventArgs } =
          await executeRouter(planner, amountInMax)
        const { amount0, amount1 } = v3SwapEventArgs!
        const [daiTraded, wethTraded] = isTokenOrderCorrect(daiContract, wethContract)
          ? [amount0, amount1]
          : [amount1, amount0]

        expect(daiBalanceBefore.sub(daiBalanceAfter)).to.eq(daiTraded)
        expect(ethBalanceBefore.sub(ethBalanceAfter)).to.eq(wethTraded.add(gasSpent))
      })
    })
  })

  describe('Mixing V2 and V3', () => {
    describe('with Universal Router.', () => {
      beforeEach(async () => {
        // for these tests Bob gives the router max approval on permit2
        await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)
        await permit2.approve(wethContract.address, router.address, MAX_UINT160, DEADLINE)
      })

      describe('Interleaving routes', () => {
        it('V3, then V2', async () => {
          const v3Tokens = [daiContract.address, usdcContract.address]
          const v2Tokens = [usdcContract.address, wethContract.address]
          const v3AmountIn: BigNumber = expandTo18DecimalsBN(5)
          const v3AmountOutMin = 0
          const v2AmountOutMin = expandTo18DecimalsBN(0.0005)

          planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
            computePairAddress(v2Factory.address, usdcContract.address, wethContract.address),
            v3AmountIn,
            v3AmountOutMin,
            encodePathExactInput(v3Tokens),
            SOURCE_MSG_SENDER,
          ])
          // amountIn of 0 because the USDC is already in the pair
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [MSG_SENDER, 0, v2AmountOutMin, v2Tokens, SOURCE_MSG_SENDER])

          const { wethBalanceBefore, wethBalanceAfter, v2SwapEventArgs } = await executeRouter(planner)
          const { amount0Out, amount1Out } = v2SwapEventArgs!
          const wethTraded = isTokenOrderCorrect(usdcContract, wethContract) ? amount1Out : amount0Out
          expect(wethBalanceAfter.sub(wethBalanceBefore)).to.eq(wethTraded)
        })

        it('V2, then V3', async () => {
          const v2Tokens = [daiContract.address, usdcContract.address]
          const v3Tokens = [usdcContract.address, wethContract.address]
          const v2AmountIn: BigNumber = expandTo18DecimalsBN(5)
          const v2AmountOutMin = 0 // doesnt matter how much USDC it is, what matters is the end of the trade
          const v3AmountOutMin = expandTo18DecimalsBN(0.0005)

          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
            router.address,
            v2AmountIn,
            v2AmountOutMin,
            v2Tokens,
            SOURCE_MSG_SENDER,
          ])
          planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
            MSG_SENDER,
            CONTRACT_BALANCE,
            v3AmountOutMin,
            encodePathExactInput(v3Tokens),
            SOURCE_ROUTER,
          ])

          const { wethBalanceBefore, wethBalanceAfter, v3SwapEventArgs } = await executeRouter(planner)
          const { amount0, amount1 } = v3SwapEventArgs!
          const wethTraded = isTokenOrderCorrect(usdcContract, wethContract) ? amount1 : amount0
          expect(wethBalanceAfter.sub(wethBalanceBefore)).to.eq(wethTraded.mul(-1))
        })
      })

      describe('Split routes', () => {
        it('ERC20 --> ERC20 split V2 and V2 different routes, each two hop, with explicit permit transfer from', async () => {
          const route1 = [daiContract.address, usdcContract.address, wethContract.address]
          const route2 = [daiContract.address, usdtContract.address, wethContract.address]
          const v2AmountIn1: BigNumber = expandTo18DecimalsBN(20)
          const v2AmountIn2: BigNumber = expandTo18DecimalsBN(30)
          const minAmountOut1 = expandTo18DecimalsBN(0.005)
          const minAmountOut2 = expandTo18DecimalsBN(0.0075)

          // 1) transfer funds into DAI-USDC and DAI-USDT pairs to trade
          planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
            daiContract.address,
            computePairAddress(v2Factory.address, daiContract.address, usdcContract.address),
            v2AmountIn1,
          ])
          planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
            daiContract.address,
            computePairAddress(v2Factory.address, daiContract.address, usdtContract.address),
            v2AmountIn2,
          ])

          // 2) trade route1 and return tokens to bob
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [MSG_SENDER, 0, minAmountOut1, route1, SOURCE_MSG_SENDER])
          // 3) trade route2 and return tokens to bob
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [MSG_SENDER, 0, minAmountOut2, route2, SOURCE_MSG_SENDER])

          const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
          expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gte(minAmountOut1.add(minAmountOut2))
        })

        it('ERC20 --> ERC20 split V2 and V2 different routes, each two hop, with explicit permit transfer from batch', async () => {
          const route1 = [daiContract.address, usdcContract.address, wethContract.address]
          const route2 = [daiContract.address, usdtContract.address, wethContract.address]
          const v2AmountIn1: BigNumber = expandTo18DecimalsBN(20)
          const v2AmountIn2: BigNumber = expandTo18DecimalsBN(30)
          const minAmountOut1 = expandTo18DecimalsBN(0.005)
          const minAmountOut2 = expandTo18DecimalsBN(0.0075)

          const BATCH_TRANSFER = [
            {
              from: bob.address,
              to: computePairAddress(v2Factory.address, daiContract.address, usdcContract.address),
              amount: v2AmountIn1,
              token: daiContract.address,
            },
            {
              from: bob.address,
              to: computePairAddress(v2Factory.address, daiContract.address, usdtContract.address),
              amount: v2AmountIn2,
              token: daiContract.address,
            },
          ]

          // 1) transfer funds into DAI-USDC and DAI-USDT pairs to trade
          planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM_BATCH, [BATCH_TRANSFER])

          // 2) trade route1 and return tokens to bob
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [MSG_SENDER, 0, minAmountOut1, route1, SOURCE_MSG_SENDER])
          // 3) trade route2 and return tokens to bob
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [MSG_SENDER, 0, minAmountOut2, route2, SOURCE_MSG_SENDER])

          const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
          expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gte(minAmountOut1.add(minAmountOut2))
        })

        it('ERC20 --> ERC20 split V2 and V2 different routes, each two hop, without explicit permit', async () => {
          const route1 = [daiContract.address, usdcContract.address, wethContract.address]
          const route2 = [daiContract.address, usdtContract.address, wethContract.address]
          const v2AmountIn1: BigNumber = expandTo18DecimalsBN(20)
          const v2AmountIn2: BigNumber = expandTo18DecimalsBN(30)
          const minAmountOut1 = expandTo18DecimalsBN(0.005)
          const minAmountOut2 = expandTo18DecimalsBN(0.0075)

          // 1) trade route1 and return tokens to bob
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
            MSG_SENDER,
            v2AmountIn1,
            minAmountOut1,
            route1,
            SOURCE_MSG_SENDER,
          ])
          // 2) trade route2 and return tokens to bob
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
            MSG_SENDER,
            v2AmountIn2,
            minAmountOut2,
            route2,
            SOURCE_MSG_SENDER,
          ])

          const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
          expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gte(minAmountOut1.add(minAmountOut2))
        })

        it('ERC20 --> ERC20 split V2 and V2 different routes, different input tokens, each two hop, with batch permit', async () => {
          const route1 = [daiContract.address, wethContract.address, usdcContract.address]
          const route2 = [wethContract.address, daiContract.address, usdcContract.address]
          const v2AmountIn1: BigNumber = expandTo18DecimalsBN(20)
          const v2AmountIn2: BigNumber = expandTo18DecimalsBN(5)
          const minAmountOut1 = BigNumber.from(0.005 * 10 ** 6)
          const minAmountOut2 = BigNumber.from(0.0075 * 10 ** 6)

          const BATCH_PERMIT = {
            details: [
              {
                token: daiContract.address,
                amount: v2AmountIn1,
                expiration: 0, // expiration of 0 is block.timestamp
                nonce: 0, // this is his first trade
              },
              {
                token: wethContract.address,
                amount: v2AmountIn2,
                expiration: 0, // expiration of 0 is block.timestamp
                nonce: 0, // this is his first trade
              },
            ],
            spender: router.address,
            sigDeadline: DEADLINE,
          }

          const sig = await getPermitBatchSignature(BATCH_PERMIT, bob, permit2)

          // 1) transfer funds into DAI-USDC and DAI-USDT pairs to trade
          planner.addCommand(CommandType.PERMIT2_PERMIT_BATCH, [BATCH_PERMIT, sig])

          // 2) trade route1 and return tokens to bob
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
            MSG_SENDER,
            v2AmountIn1,
            minAmountOut1,
            route1,
            SOURCE_MSG_SENDER,
          ])
          // 3) trade route2 and return tokens to bob
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
            MSG_SENDER,
            v2AmountIn2,
            minAmountOut2,
            route2,
            SOURCE_MSG_SENDER,
          ])

          const { usdcBalanceBefore, usdcBalanceAfter } = await executeRouter(planner)
          expect(usdcBalanceAfter.sub(usdcBalanceBefore)).to.be.gte(minAmountOut1.add(minAmountOut2))
        })

        it('ERC20 --> ERC20 V3 trades with different input tokens with batch permit and batch transfer', async () => {
          const route1 = [daiContract.address, wethContract.address]
          const route2 = [wethContract.address, usdcContract.address]
          const v3AmountIn1: BigNumber = expandTo18DecimalsBN(20)
          const v3AmountIn2: BigNumber = expandTo18DecimalsBN(5)
          const minAmountOut1WETH = BigNumber.from(0)
          const minAmountOut1USDC = BigNumber.from(0.005 * 10 ** 6)
          const minAmountOut2USDC = BigNumber.from(0.0075 * 10 ** 6)

          const BATCH_PERMIT = {
            details: [
              {
                token: daiContract.address,
                amount: v3AmountIn1,
                expiration: 0, // expiration of 0 is block.timestamp
                nonce: 0, // this is his first trade
              },
              {
                token: wethContract.address,
                amount: v3AmountIn2,
                expiration: 0, // expiration of 0 is block.timestamp
                nonce: 0, // this is his first trade
              },
            ],
            spender: router.address,
            sigDeadline: DEADLINE,
          }

          const BATCH_TRANSFER = [
            {
              from: bob.address,
              to: router.address,
              amount: v3AmountIn1,
              token: daiContract.address,
            },
            {
              from: bob.address,
              to: router.address,
              amount: v3AmountIn2,
              token: wethContract.address,
            },
          ]

          const sig = await getPermitBatchSignature(BATCH_PERMIT, bob, permit2)

          // 1) permit dai and weth to be spent by router
          planner.addCommand(CommandType.PERMIT2_PERMIT_BATCH, [BATCH_PERMIT, sig])

          // 2) transfer dai and weth into router to use contract balance
          planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM_BATCH, [BATCH_TRANSFER])

          // v3SwapExactInput(recipient, amountIn, amountOutMin, path, payer);

          // 2) trade route1 and return tokens to router for the second trade
          planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
            ADDRESS_THIS,
            CONTRACT_BALANCE,
            minAmountOut1WETH,
            encodePathExactInput(route1),
            SOURCE_ROUTER,
          ])
          // 3) trade route2 and return tokens to bob
          planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
            MSG_SENDER,
            CONTRACT_BALANCE,
            minAmountOut1USDC.add(minAmountOut2USDC),
            encodePathExactInput(route2),
            SOURCE_ROUTER,
          ])

          const { usdcBalanceBefore, usdcBalanceAfter } = await executeRouter(planner)
          expect(usdcBalanceAfter.sub(usdcBalanceBefore)).to.be.gte(minAmountOut1USDC.add(minAmountOut2USDC))
        })

        it('ERC20 --> ERC20 split V2 and V3, one hop', async () => {
          const tokens = [daiContract.address, wethContract.address]
          const v2AmountIn: BigNumber = expandTo18DecimalsBN(2)
          const v3AmountIn: BigNumber = expandTo18DecimalsBN(3)
          const minAmountOut = expandTo18DecimalsBN(0.0005)

          // V2 trades DAI for USDC, sending the tokens back to the router for v3 trade
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [router.address, v2AmountIn, 0, tokens, SOURCE_MSG_SENDER])
          // V3 trades USDC for WETH, trading the whole balance, with a recipient of Alice
          planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
            router.address,
            v3AmountIn,
            0,
            encodePathExactInput(tokens),
            SOURCE_MSG_SENDER,
          ])
          // aggregate slippate check
          planner.addCommand(CommandType.SWEEP, [wethContract.address, MSG_SENDER, minAmountOut])

          const { wethBalanceBefore, wethBalanceAfter, v2SwapEventArgs, v3SwapEventArgs } = await executeRouter(planner)
          const { amount0Out, amount1Out } = v2SwapEventArgs!
          const wethOutV2 = isTokenOrderCorrect(daiContract, wethContract) ? amount1Out : amount0Out
          const { amount0, amount1 } = v3SwapEventArgs!
          let wethOutV3 = isTokenOrderCorrect(daiContract, wethContract) ? amount1 : amount0

          // expect(daiBalanceBefore.sub(daiBalanceAfter)).to.eq(v2AmountIn.add(v3AmountIn)) // TODO: with permit2 can check from alice's balance
          expect(wethBalanceAfter.sub(wethBalanceBefore)).to.eq(wethOutV2.sub(wethOutV3))
        })

        it('ETH --> ERC20 split V2 and V3, one hop', async () => {
          const tokens = [wethContract.address, usdcContract.address]
          const v2AmountIn: BigNumber = expandTo18DecimalsBN(2)
          const v3AmountIn: BigNumber = expandTo18DecimalsBN(3)
          const value = v2AmountIn.add(v3AmountIn)

          planner.addCommand(CommandType.WRAP_ETH, [router.address, value])
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [router.address, v2AmountIn, 0, tokens, SOURCE_ROUTER])
          planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
            router.address,
            v3AmountIn,
            0,
            encodePathExactInput(tokens),
            SOURCE_MSG_SENDER,
          ])
          // aggregate slippate check
          planner.addCommand(CommandType.SWEEP, [usdcContract.address, MSG_SENDER, 0.0005 * 10 ** 6])

          const { usdcBalanceBefore, usdcBalanceAfter, v2SwapEventArgs, v3SwapEventArgs } = await executeRouter(
            planner,
            value
          )
          const { amount0Out, amount1Out } = v2SwapEventArgs!
          const usdcOutV2 = isTokenOrderCorrect(usdcContract, wethContract) ? amount0Out : amount1Out
          const { amount0, amount1 } = v3SwapEventArgs!
          let usdcOutV3 = isTokenOrderCorrect(usdcContract, wethContract) ? amount0 : amount1
          usdcOutV3 = usdcOutV3.mul(-1)
          expect(usdcBalanceAfter.sub(usdcBalanceBefore)).to.eq(usdcOutV2.add(usdcOutV3))
        })

        it('ERC20 --> ETH split V2 and V3, one hop', async () => {
          const tokens = [daiContract.address, wethContract.address]
          const v2AmountIn: BigNumber = expandTo18DecimalsBN(20)
          const v3AmountIn: BigNumber = expandTo18DecimalsBN(30)

          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [router.address, v2AmountIn, 0, tokens, SOURCE_MSG_SENDER])
          planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
            router.address,
            v3AmountIn,
            0,
            encodePathExactInput(tokens),
            SOURCE_MSG_SENDER,
          ])
          // aggregate slippate check
          planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, expandTo18DecimalsBN(0.0005)])

          const { ethBalanceBefore, ethBalanceAfter, gasSpent, v2SwapEventArgs, v3SwapEventArgs } = await executeRouter(
            planner
          )
          const { amount0Out, amount1Out } = v2SwapEventArgs!
          const wethOutV2 = isTokenOrderCorrect(daiContract, wethContract) ? amount1Out : amount0Out
          const { amount0, amount1 } = v3SwapEventArgs!
          let wethOutV3 = isTokenOrderCorrect(daiContract, wethContract) ? amount1 : amount0
          wethOutV3 = wethOutV3.mul(-1)

          expect(ethBalanceAfter.sub(ethBalanceBefore)).to.eq(wethOutV2.add(wethOutV3).sub(gasSpent))
        })

        it('ERC20 --> ETH split V2 and V3, exactOut, one hop', async () => {
          const tokens = [daiContract.address, wethContract.address]
          const v2AmountOut: BigNumber = expandTo18DecimalsBN(0.5)
          const v3AmountOut: BigNumber = expandTo18DecimalsBN(1)
          const path = encodePathExactOutput(tokens)
          const maxAmountIn = expandTo18DecimalsBN(4000)
          const fullAmountOut = v2AmountOut.add(v3AmountOut)

          planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
            router.address,
            v2AmountOut,
            maxAmountIn,
            [daiContract.address, wethContract.address],
            SOURCE_MSG_SENDER,
          ])
          planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [
            router.address,
            v3AmountOut,
            maxAmountIn,
            path,
            SOURCE_MSG_SENDER,
          ])
          // aggregate slippate check
          planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, fullAmountOut])

          const { ethBalanceBefore, ethBalanceAfter, gasSpent } = await executeRouter(planner)

          // TODO: permit2 test alice doesn't send more than maxAmountIn DAI
          expect(ethBalanceAfter.sub(ethBalanceBefore)).to.eq(fullAmountOut.sub(gasSpent))
        })
      })
    })
  })

  type V2SwapEventArgs = {
    amount0In: BigNumber
    amount0Out: BigNumber
    amount1In: BigNumber
    amount1Out: BigNumber
  }

  type V3SwapEventArgs = {
    amount0: BigNumber
    amount1: BigNumber
  }

  type ExecutionParams = {
    wethBalanceBefore: BigNumber
    wethBalanceAfter: BigNumber
    daiBalanceBefore: BigNumber
    daiBalanceAfter: BigNumber
    usdcBalanceBefore: BigNumber
    usdcBalanceAfter: BigNumber
    ethBalanceBefore: BigNumber
    ethBalanceAfter: BigNumber
    v2SwapEventArgs: V2SwapEventArgs | undefined
    v3SwapEventArgs: V3SwapEventArgs | undefined
    receipt: TransactionReceipt
    gasSpent: BigNumber
  }

  async function executeRouter(planner: RoutePlanner, value?: BigNumberish): Promise<ExecutionParams> {
    const ethBalanceBefore: BigNumber = await ethers.provider.getBalance(bob.address)
    const wethBalanceBefore: BigNumber = await wethContract.balanceOf(bob.address)
    const daiBalanceBefore: BigNumber = await daiContract.balanceOf(bob.address)
    const usdcBalanceBefore: BigNumber = await usdcContract.balanceOf(bob.address)

    const { commands, inputs } = planner

    const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()
    const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const v2SwapEventArgs = parseEvents(V2_EVENTS, receipt)[0]?.args as unknown as V2SwapEventArgs
    const v3SwapEventArgs = parseEvents(V3_EVENTS, receipt)[0]?.args as unknown as V3SwapEventArgs

    const ethBalanceAfter: BigNumber = await ethers.provider.getBalance(bob.address)
    const wethBalanceAfter: BigNumber = await wethContract.balanceOf(bob.address)
    const daiBalanceAfter: BigNumber = await daiContract.balanceOf(bob.address)
    const usdcBalanceAfter: BigNumber = await usdcContract.balanceOf(bob.address)

    return {
      wethBalanceBefore,
      wethBalanceAfter,
      daiBalanceBefore,
      daiBalanceAfter,
      usdcBalanceBefore,
      usdcBalanceAfter,
      ethBalanceBefore,
      ethBalanceAfter,
      v2SwapEventArgs,
      v3SwapEventArgs,
      receipt,
      gasSpent,
    }
  }

  function encodePathExactInput(tokens: string[]) {
    return encodePath(tokens, new Array(tokens.length - 1).fill(FeeAmount.MEDIUM))
  }

  function encodePathExactOutput(tokens: string[]) {
    return encodePath(tokens.slice().reverse(), new Array(tokens.length - 1).fill(FeeAmount.MEDIUM))
  }
})
