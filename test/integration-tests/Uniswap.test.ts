import { Permit2, UniversalRouter } from '../../typechain'
import {
  ALICE_PRIVATE_KEY,
  BOB_PRIVATE_KEY,
  MAX_UINT,
  DEADLINE,
  MSG_SENDER,
  SOURCE_MSG_SENDER,
  MAX_UINT160,
  ONE_PERCENT_BIPS,
  ETH_ADDRESS,
  SOURCE_ROUTER,
  ZERO_ADDRESS,
  CONTRACT_BALANCE,
  ADDRESS_THIS,
} from './shared/constants'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import hre from 'hardhat'
import { parseEvents, V2_EVENTS, V3_EVENTS } from './shared/parseEvents'
import { deployPermit2, deployRouter } from './shared/deployUniversalRouter'
import { deployUniswapV2 } from './shared/deployUniswapV2'
import { deployUniswapV3 } from './shared/deployUniswapV3'
import { expect } from './shared/expect'
import { Wallet, Provider, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { expandTo18DecimalsBN, expandTo6DecimalsBN } from './shared/helpers'
import { RoutePlanner, CommandType } from './shared/planner'
import { getPermitSignature, getPermitBatchSignature, PermitSingle } from './shared/protocolHelpers/permit2'
import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'ethers'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { getMaxTick, getMinTick } from './shared/ticks'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePath } from './shared/swapRouter02Helpers'
import { ZkSyncArtifact } from '@matterlabs/hardhat-zksync-deploy/dist/types'
import WETH9Artifact from './shared/abis/WETH9.json'

/**
 * $ yarn hardhat test test/integration-tests/Uniswap.test.ts --network zkSyncLocalhost
 */
describe('Uniswap V2 and V3 Tests:', () => {
  let provider: Provider
  let deployer: Deployer
  let alice: Wallet
  let bob: Wallet
  let permit2: Permit2
  let router: UniversalRouter
  let wethContract: Contract
  let daiContract: Contract
  let usdcContract: Contract
  let usdtContract: Contract
  let planner: RoutePlanner

  let uniswapV2Factory: Contract
  let uniswapV2Router: Contract

  let uniswapV3Factory: Contract
  let nonfungiblePositionManager: Contract

  before(async () => {
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    bob = new Wallet(BOB_PRIVATE_KEY, provider)
    deployer = new Deployer(hre, alice)

    const MockERC20 = await deployer.loadArtifact('MockERC20')
    const WETH9 = WETH9Artifact as any as ZkSyncArtifact

    let dai = await deployer.deploy(MockERC20, [6])
    let usdc = await deployer.deploy(MockERC20, [6])
    let usdt = await deployer.deploy(MockERC20, [6])
    let weth = await deployer.deploy(WETH9 as any as ZkSyncArtifact, [])

    wethContract = new Contract(weth.address, WETH9.abi, alice)
    daiContract = new Contract(dai.address, MockERC20.abi, alice)
    usdcContract = new Contract(usdc.address, MockERC20.abi, alice)
    usdtContract = new Contract(usdt.address, MockERC20.abi, alice)

    let uniswapV2 = await deployUniswapV2(wethContract.address)
    uniswapV2Factory = uniswapV2[0]
    uniswapV2Router = uniswapV2[1]

    let uniswapV3 = await deployUniswapV3(wethContract.address)
    uniswapV3Factory = uniswapV3[0]
    nonfungiblePositionManager = uniswapV3[1]

    permit2 = (await deployPermit2()).connect(bob) as Permit2
    router = (
      await deployRouter(
        permit2,
        wethContract.address,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        uniswapV2Factory.address,
        uniswapV3Factory.address
      )
    ).connect(bob) as UniversalRouter
    planner = new RoutePlanner()

    await (await wethContract.connect(alice).deposit({ value: expandTo18DecimalsBN(11100) })).wait()
    await (await wethContract.connect(alice).transfer(bob.address, expandTo18DecimalsBN(11100))).wait()
    await (await daiContract.connect(alice).mint(bob.address, expandTo18DecimalsBN(11000000))).wait()
    await (await usdcContract.connect(alice).mint(bob.address, expandTo6DecimalsBN(100000))).wait()

    await (await wethContract.connect(bob).approve(permit2.address, MAX_UINT)).wait()
    await (await daiContract.connect(bob).approve(permit2.address, MAX_UINT)).wait()
    await (await usdcContract.connect(bob).approve(permit2.address, MAX_UINT)).wait()
  })

  describe('UniswapV2 setup', () => {
    it('add liquidity DAI/USDC', async () => {
      let tokenA = daiContract.address
      let tokenB = usdcContract.address
      let amountADesired = expandTo18DecimalsBN(10_000_000)
      let amountBDesired = expandTo18DecimalsBN(10_000_000)
      let amountAMin = amountADesired
      let amountBMin = amountBDesired
      let to = alice.address
      let deadline = Math.round(new Date().getTime() / 1000) + 86400
      await (await daiContract.connect(alice).mint(alice.address, amountADesired)).wait()
      await (await usdcContract.connect(alice).mint(alice.address, amountBDesired)).wait()

      await (await daiContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()
      await (await usdcContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()

      await (
        await uniswapV2Router
          .connect(alice)
          .addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)
      ).wait()

      let reserves = await uniswapV2Router.getReserves(tokenA, tokenB)

      expect(reserves[0]).to.be.eq(amountADesired)
      expect(reserves[1]).to.be.eq(amountBDesired)
    })

    it('add liquidity DAI/WETH', async () => {
      let tokenA = daiContract.address
      let tokenB = wethContract.address
      let amountADesired = expandTo18DecimalsBN(10_000_000)
      let amountBDesired = expandTo18DecimalsBN(100_000)
      let amountAMin = amountADesired
      let amountBMin = amountBDesired
      let to = alice.address
      let deadline = Math.round(new Date().getTime() / 1000) + 86400
      await (await daiContract.connect(alice).mint(alice.address, amountADesired)).wait()
      await (await wethContract.connect(alice).deposit({ value: amountBDesired })).wait()

      await (await daiContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()
      await (await wethContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()

      await (
        await uniswapV2Router
          .connect(alice)
          .addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)
      ).wait()

      let reserves = await uniswapV2Router.getReserves(tokenA, tokenB)

      expect(reserves[0]).to.be.eq(amountADesired)
      expect(reserves[1]).to.be.eq(amountBDesired)
    })

    it('add liquidity USDT/WETH', async () => {
      let tokenA = usdtContract.address
      let tokenB = wethContract.address
      let amountADesired = expandTo18DecimalsBN(10_000_000)
      let amountBDesired = expandTo18DecimalsBN(100_000)
      let amountAMin = amountADesired
      let amountBMin = amountBDesired
      let to = alice.address
      let deadline = Math.round(new Date().getTime() / 1000) + 86400
      await (await usdtContract.connect(alice).mint(alice.address, amountADesired)).wait()
      await (await wethContract.connect(alice).deposit({ value: amountBDesired })).wait()

      await (await usdtContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()
      await (await wethContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()

      await (
        await uniswapV2Router
          .connect(alice)
          .addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)
      ).wait()

      let reserves = await uniswapV2Router.getReserves(tokenA, tokenB)

      expect(reserves[0]).to.be.eq(amountADesired)
      expect(reserves[1]).to.be.eq(amountBDesired)
    })

    it('add liquidity DAI/USDT', async () => {
      let tokenA = daiContract.address
      let tokenB = usdtContract.address
      let amountADesired = expandTo18DecimalsBN(10_000_000)
      let amountBDesired = expandTo18DecimalsBN(10_000_000)
      let amountAMin = amountADesired
      let amountBMin = amountBDesired
      let to = alice.address
      let deadline = Math.round(new Date().getTime() / 1000) + 86400
      await (await daiContract.connect(alice).mint(alice.address, amountADesired)).wait()
      await (await usdtContract.connect(alice).mint(alice.address, amountADesired)).wait()

      await (await daiContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()
      await (await usdtContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()

      await (
        await uniswapV2Router
          .connect(alice)
          .addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)
      ).wait()

      let reserves = await uniswapV2Router.getReserves(tokenA, tokenB)

      expect(reserves[0]).to.be.eq(amountADesired)
      expect(reserves[1]).to.be.eq(amountBDesired)
    })

    it('add liquidity USDC/WETH', async () => {
      let tokenA = usdcContract.address
      let tokenB = wethContract.address
      let amountADesired = expandTo18DecimalsBN(10_000_000)
      let amountBDesired = expandTo18DecimalsBN(1_000_000)
      let amountAMin = amountADesired
      let amountBMin = amountBDesired
      let to = alice.address
      let deadline = Math.round(new Date().getTime() / 1000) + 86400
      await (await usdcContract.connect(alice).mint(alice.address, amountADesired)).wait()
      await (await wethContract.connect(alice).deposit({ value: amountBDesired })).wait()

      await (await usdcContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()
      await (await wethContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()

      await (
        await uniswapV2Router
          .connect(alice)
          .addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)
      ).wait()

      let reserves = await uniswapV2Router.getReserves(tokenA, tokenB)

      expect(reserves[0]).to.be.eq(amountADesired)
      expect(reserves[1]).to.be.eq(amountBDesired)
    })

    it.skip('swap dai to weth', async () => {
      const amountInDAI = expandTo18DecimalsBN(100)

      let swapper = bob
      let swapperAddress = bob.address

      await daiContract.connect(swapper).approve(uniswapV2Router.address, MAX_UINT)
      await wethContract.connect(swapper).approve(uniswapV2Router.address, MAX_UINT)

      let amountIn = amountInDAI
      let amountOutMin = 0
      let path = [daiContract.address, wethContract.address]
      let to = swapperAddress
      let deadlile = Math.round(new Date().getTime() / 1000) + 86400
      await (
        await uniswapV2Router.connect(bob).swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadlile)
      ).wait()
    })
  })

  describe('Trade on Uniswap with Permit2, giving approval every time', () => {
    describe('ERC20 --> ERC20', () => {
      let permitSingle: PermitSingle
      beforeEach(async () => {
        planner = new RoutePlanner()
      })

      it('V2 exactIn, permiting the exact amount', async () => {
        const amountInDAI = expandTo18DecimalsBN(100)
        const minAmountOutWETH = 0

        // second bob signs a permitSingle to allow the router to access his DAI
        permitSingle = {
          details: {
            token: daiContract.address,
            amount: amountInDAI,
            expiration: 0, // expiration of 0 is block.timestamp
            nonce: 0, // this is his first trade
          },
          spender: router.address,
          sigDeadline: DEADLINE,
        }

        const signingKey: ethers.utils.SigningKey = new ethers.utils.SigningKey(BOB_PRIVATE_KEY)
        const sig = await getPermitSignature(permitSingle, signingKey, permit2)

        planner.addCommand(CommandType.PERMIT2_PERMIT, [permitSingle, sig])
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

        // second bob signs a permitSingle to allow the router to access his DAI
        permitSingle = {
          details: {
            token: daiContract.address,
            amount: maxAmountInDAI,
            expiration: 0, // expiration of 0 is block.timestamp
            nonce: 0, // this is his first trade
          },
          spender: router.address,
          sigDeadline: DEADLINE,
        }

        const signingKey: ethers.utils.SigningKey = new ethers.utils.SigningKey(BOB_PRIVATE_KEY)
        const sig = await getPermitSignature(permitSingle, signingKey, permit2)

        // 1) permitSingle the router to access funds, 2) trade - the transfer happens within the trade for exactOut
        planner.addCommand(CommandType.PERMIT2_PERMIT, [permitSingle, sig])
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

        // second bob signs a permitSingle to allow the router to access his DAI
        permitSingle = {
          details: {
            token: daiContract.address,
            amount: max_uint,
            expiration: 0, // expiration of 0 is block.timestamp
            nonce: 0, // this is his first trade
          },
          spender: router.address,
          sigDeadline: DEADLINE,
        }
        const signingKey: ethers.utils.SigningKey = new ethers.utils.SigningKey(BOB_PRIVATE_KEY)
        const sig = await getPermitSignature(permitSingle, signingKey, permit2)

        // 1) permitSingle the router to access funds, 2) withdraw the funds into the pair, 3) trade
        planner.addCommand(CommandType.PERMIT2_PERMIT, [permitSingle, sig])
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          MSG_SENDER,
          BigNumber.from(MAX_UINT160).add(1),
          minAmountOutWETH,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])

        await expect(executeRouter(planner)).to.be.reverted
      })
    })
  })

  describe('Trade on UniswapV2', () => {
    const amountIn: BigNumber = expandTo18DecimalsBN(5)
    beforeEach(async () => {
      // for these tests Bob gives the router max approval on permit2
      await (await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)).wait()
      await (await permit2.approve(wethContract.address, router.address, MAX_UINT160, DEADLINE)).wait()
      planner = new RoutePlanner()
    })

    describe('ERC20 --> ERC20', () => {
      it('completes a V2 exactIn swap', async () => {
        const minAmountOut = 0 //expandTo18DecimalsBN(0.0001)

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

        let daiBalanceBefore = await daiContract.balanceOf(bob.address)

        await executeRouter(planner)

        let daiBalanceAfter = await daiContract.balanceOf(bob.address)

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

        await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).wait()

        const wethBalanceAfterAlice = await wethContract.balanceOf(alice.address)
        const wethBalanceAfterBob = await wethContract.balanceOf(bob.address)

        const aliceFee = wethBalanceAfterAlice.sub(wethBalanceBeforeAlice)
        const bobEarnings = wethBalanceAfterBob.sub(wethBalanceBeforeBob)

        expect(aliceFee).to.be.gt(0)
        expect(bobEarnings).to.be.gt(0)
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
        const amountDaiIn = expandTo18DecimalsBN(1000)
        const minWethAmountOut = expandTo18DecimalsBN(0.0001)

        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          router.address,
          amountDaiIn,
          minWethAmountOut,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0])

        const ethBalanceBefore = await provider.getBalance(bob.address)

        await executeRouter(planner)

        const ethBalanceAfter = await provider.getBalance(bob.address)

        expect(ethBalanceAfter.sub(ethBalanceBefore)).to.gt(0)
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

        await executeRouter(planner)
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
        const ethBalanceBeforeAlice = await provider.getBalance(alice.address)
        const ethBalanceBeforeBob = await provider.getBalance(bob.address)
        const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).wait()

        const ethBalanceAfterAlice = await provider.getBalance(alice.address)
        const ethBalanceAfterBob = await provider.getBalance(bob.address)
        const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)

        const aliceFee = ethBalanceAfterAlice.sub(ethBalanceBeforeAlice)
        const bobEarnings = ethBalanceAfterBob.sub(ethBalanceBeforeBob).add(gasSpent)

        expect(aliceFee).to.be.gt(0)
        expect(bobEarnings).to.be.gt(0)
      })
    })

    describe('ETH --> ERC20', () => {
      it('completes a V2 exactIn swap', async () => {
        const minAmountOut = expandTo18DecimalsBN(0.001)
        const pairAddress = await uniswapV2Factory.getPair(daiContract.address, wethContract.address)

        planner.addCommand(CommandType.WRAP_ETH, [pairAddress, amountIn])

        // amountIn of 0 because the weth is already in the pair
        planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
          MSG_SENDER,
          0,
          minAmountOut,
          [wethContract.address, daiContract.address],
          SOURCE_MSG_SENDER,
        ])
        const daiBalanceBefore = await daiContract.balanceOf(bob.address)

        await executeRouter(planner, amountIn)

        const daiBalanceAfter = await daiContract.balanceOf(bob.address)

        expect(daiBalanceAfter.sub(daiBalanceBefore)).to.be.gt(minAmountOut)
      })

      it('completes a V2 exactOut swap', async () => {
        const amountOut = expandTo18DecimalsBN(100)
        const value = expandTo18DecimalsBN(1.5)

        planner.addCommand(CommandType.WRAP_ETH, [router.address, value])
        planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
          MSG_SENDER,
          amountOut,
          value,
          [wethContract.address, daiContract.address],
          SOURCE_ROUTER,
        ])
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0])

        const daiBalanceBefore = await daiContract.balanceOf(bob.address)

        await executeRouter(planner, value)

        const daiBalanceAfter = await daiContract.balanceOf(bob.address)

        expect(daiBalanceAfter.sub(daiBalanceBefore)).gt(amountOut) // rounding
      })
    })
  })

  describe('UniswapV3 setup', () => {
    it('add liquidity WETH/DAI', async () => {
      await (await wethContract.connect(alice).deposit({ value: expandTo18DecimalsBN(50_000) })).wait()
      await (await daiContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(100_000_000))).wait()

      await (await wethContract.connect(alice).approve(nonfungiblePositionManager.address, MAX_UINT)).wait()
      await (await daiContract.connect(alice).approve(nonfungiblePositionManager.address, MAX_UINT)).wait()

      let tokenAddressA = wethContract.address
      let tokenAddressB = daiContract.address

      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase()) {
        ;[tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]
      }

      let amount0Desired
      let amount1Desired
      let sqrtPrice
      if (tokenAddressA == wethContract.address) {
        amount0Desired = expandTo18DecimalsBN(50_000)
        amount1Desired = expandTo18DecimalsBN(100_000_000)
        sqrtPrice = encodePriceSqrt(amount1Desired, amount0Desired)
      } else {
        amount0Desired = expandTo18DecimalsBN(100_000_000)
        amount1Desired = expandTo18DecimalsBN(50_000)
        sqrtPrice = encodePriceSqrt(amount1Desired, amount0Desired)
      }

      await (
        await nonfungiblePositionManager
          .connect(alice)
          .createAndInitializePoolIfNecessary(tokenAddressA, tokenAddressB, FeeAmount.MEDIUM, sqrtPrice)
      ).wait()

      let mintParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        amount0Desired: amount0Desired,
        amount1Desired: amount1Desired,
        amount0Min: 0,
        amount1Min: 0,
        recipient: alice.address,
        deadline: DEADLINE,
      }

      await (await nonfungiblePositionManager.connect(alice).mint(mintParams)).wait()
    })

    it('add liquidity WETH/USDC', async () => {
      await (await wethContract.connect(alice).deposit({ value: expandTo18DecimalsBN(50_000) })).wait()
      await (await usdcContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(100_000_000))).wait()

      await (await wethContract.connect(alice).approve(nonfungiblePositionManager.address, MAX_UINT)).wait()
      await (await usdcContract.connect(alice).approve(nonfungiblePositionManager.address, MAX_UINT)).wait()

      let tokenAddressA = wethContract.address
      let tokenAddressB = usdcContract.address

      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase()) {
        ;[tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]
      }

      let amount0Desired
      let amount1Desired
      let sqrtPrice
      if (tokenAddressA == wethContract.address) {
        amount0Desired = expandTo18DecimalsBN(50_000)
        amount1Desired = expandTo18DecimalsBN(100_000_000)
        sqrtPrice = encodePriceSqrt(amount1Desired, amount0Desired)
      } else {
        amount0Desired = expandTo18DecimalsBN(100_000_000)
        amount1Desired = expandTo18DecimalsBN(50_000)
        sqrtPrice = encodePriceSqrt(amount1Desired, amount0Desired)
      }

      await (
        await nonfungiblePositionManager
          .connect(alice)
          .createAndInitializePoolIfNecessary(tokenAddressA, tokenAddressB, FeeAmount.MEDIUM, sqrtPrice)
      ).wait()

      let mintParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        amount0Desired: amount0Desired,
        amount1Desired: amount1Desired,
        amount0Min: 0,
        amount1Min: 0,
        recipient: alice.address,
        deadline: DEADLINE,
      }
      await (await nonfungiblePositionManager.connect(alice).mint(mintParams)).wait()
    })

    it('add liquidity DAI/USDC', async () => {
      await (await daiContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(100_000_000))).wait()
      await (await usdcContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(100_000_000))).wait()

      await (await daiContract.connect(alice).approve(nonfungiblePositionManager.address, MAX_UINT)).wait()
      await (await usdcContract.connect(alice).approve(nonfungiblePositionManager.address, MAX_UINT)).wait()

      let tokenAddressA = daiContract.address
      let tokenAddressB = usdcContract.address

      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase()) {
        ;[tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]
      }

      let amount0Desired
      let amount1Desired
      let sqrtPrice
      if (tokenAddressA == daiContract.address) {
        amount0Desired = expandTo18DecimalsBN(100_000_000)
        amount1Desired = expandTo18DecimalsBN(100_000_000)
        sqrtPrice = encodePriceSqrt(amount1Desired, amount0Desired)
      } else {
        amount0Desired = expandTo18DecimalsBN(100_000_000)
        amount1Desired = expandTo18DecimalsBN(100_000_000)
        sqrtPrice = encodePriceSqrt(amount1Desired, amount0Desired)
      }

      await (
        await nonfungiblePositionManager
          .connect(alice)
          .createAndInitializePoolIfNecessary(tokenAddressA, tokenAddressB, FeeAmount.MEDIUM, sqrtPrice)
      ).wait()

      let mintParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        amount0Desired: amount0Desired,
        amount1Desired: amount1Desired,
        amount0Min: 0,
        amount1Min: 0,
        recipient: alice.address,
        deadline: DEADLINE,
      }

      await (await nonfungiblePositionManager.connect(alice).mint(mintParams)).wait()
    })
  })

  describe('Trade on UniswapV3', () => {
    const amountIn: BigNumber = expandTo18DecimalsBN(500)
    const amountInMax: BigNumber = expandTo18DecimalsBN(20_000)
    const amountOut: BigNumber = expandTo18DecimalsBN(1)

    beforeEach(async () => {
      // for these tests Bob gives the router max approval on permit2
      await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)
      await permit2.approve(wethContract.address, router.address, MAX_UINT160, DEADLINE)
      planner = new RoutePlanner()
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
        await (await daiContract.connect(alice).mint(bob.address, expandTo18DecimalsBN(99_999_999))).wait()
        const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gte(amountOutMin)
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

        const { daiBalanceBefore, daiBalanceAfter, usdcBalanceBefore, usdcBalanceAfter } = await executeRouter(planner)

        expect(daiBalanceBefore).to.be.gt(daiBalanceAfter)
        expect(usdcBalanceAfter.sub(usdcBalanceBefore)).to.be.gte(amountOutMin)
      })

      it('completes a V3 exactOut swap', async () => {
        // trade DAI in for WETH out
        const tokens = [daiContract.address, wethContract.address]
        const path = encodePathExactOutput(tokens)

        planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [MSG_SENDER, amountOut, amountInMax, path, SOURCE_MSG_SENDER])

        const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
        expect(wethBalanceAfter.sub(wethBalanceBefore)).to.eq(amountOut)
      })

      it('completes a V3 exactOut swap with longer path', async () => {
        // trade DAI in for WETH out
        const tokens = [daiContract.address, usdcContract.address, wethContract.address]
        const path = encodePathExactOutput(tokens)
        // for these tests Bob gives the router max approval on permit2
        // await permit2.approve(DAI.address, router.address, MAX_UINT160, DEADLINE)

        planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [MSG_SENDER, amountOut, amountInMax, path, SOURCE_MSG_SENDER])
        const { commands, inputs } = planner

        const balanceWethBefore = await wethContract.balanceOf(bob.address)
        await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).wait()
        const balanceWethAfter = await wethContract.balanceOf(bob.address)
        expect(balanceWethAfter.sub(balanceWethBefore)).to.eq(amountOut)
      })
    })

    describe('ERC20 --> ETH', () => {
      it('completes a V3 exactIn swap', async () => {
        const amountOutMin: BigNumber = expandTo18DecimalsBN(0.0005)
        addV3ExactInTrades(planner, 1, amountOutMin, router.address)
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0])

        const { ethBalanceBefore, ethBalanceAfter } = await executeRouter(planner)

        expect(ethBalanceAfter).to.be.gt(ethBalanceBefore)
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

        const { ethBalanceBefore, ethBalanceAfter } = await executeRouter(planner)

        expect(ethBalanceAfter).to.be.gt(ethBalanceBefore)
      })
    })

    describe('ETH --> ERC20', () => {
      it('completes a V3 exactIn swap', async () => {
        const tokens = [wethContract.address, daiContract.address]
        const amountOutMin: BigNumber = expandTo18DecimalsBN(0.0005)

        planner.addCommand(CommandType.WRAP_ETH, [router.address, amountIn])
        addV3ExactInTrades(planner, 1, amountOutMin, MSG_SENDER, tokens, SOURCE_ROUTER)

        const { ethBalanceBefore, ethBalanceAfter, daiBalanceBefore, daiBalanceAfter } = await executeRouter(
          planner,
          amountIn
        )

        expect(ethBalanceBefore).to.gt(ethBalanceAfter)
        expect(daiBalanceAfter.sub(daiBalanceBefore)).to.be.gte(amountOutMin)
      })

      it('completes a V3 exactOut swap', async () => {
        const tokens = [wethContract.address, daiContract.address]
        const path = encodePathExactOutput(tokens)

        planner.addCommand(CommandType.WRAP_ETH, [router.address, amountInMax])
        planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [MSG_SENDER, amountOut, amountInMax, path, SOURCE_ROUTER])
        planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0])

        const { ethBalanceBefore, ethBalanceAfter, daiBalanceBefore, daiBalanceAfter } = await executeRouter(
          planner,
          amountInMax
        )

        expect(daiBalanceBefore).to.lt(daiBalanceAfter)
        expect(ethBalanceBefore).to.gt(ethBalanceAfter)
      })
    })
  })

  describe('Mixing V2 and V3', () => {
    describe('with Universal Router.', () => {
      let pair_dai_usdc: string
      let pair_dai_usdt: string

      before(async () => {
        pair_dai_usdc = await uniswapV2Factory.getPair(daiContract.address, usdcContract.address)
        pair_dai_usdt = await uniswapV2Factory.getPair(daiContract.address, usdtContract.address)
      })

      beforeEach(async () => {
        // for these tests Bob gives the router max approval on permit2
        await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)
        await permit2.approve(wethContract.address, router.address, MAX_UINT160, DEADLINE)
        planner = new RoutePlanner()
      })

      describe('Interleaving routes', () => {
        it('V3, then V2', async () => {
          const v3Tokens = [daiContract.address, usdcContract.address]
          const v2Tokens = [usdcContract.address, wethContract.address]
          const v3AmountIn: BigNumber = expandTo18DecimalsBN(5)
          const v3AmountOutMin = 0
          const v2AmountOutMin = expandTo18DecimalsBN(0.0005)

          const pair_usdc_weth = await uniswapV2Factory.getPair(usdcContract.address, wethContract.address)
          planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
            pair_usdc_weth, //Pair.getAddress(USDC, WETH),
            v3AmountIn,
            v3AmountOutMin,
            encodePathExactInput(v3Tokens),
            SOURCE_MSG_SENDER,
          ])
          // amountIn of 0 because the USDC is already in the pair
          planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [MSG_SENDER, 0, v2AmountOutMin, v2Tokens, SOURCE_MSG_SENDER])

          const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
          expect(wethBalanceAfter).to.gt(wethBalanceBefore)
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

          const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)
          expect(wethBalanceAfter).to.gt(wethBalanceBefore)
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
          planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [daiContract.address, pair_dai_usdc, v2AmountIn1])
          planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [daiContract.address, pair_dai_usdt, v2AmountIn2])

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
              to: pair_dai_usdc,
              amount: v2AmountIn1,
              token: daiContract.address,
            },
            {
              from: bob.address,
              to: pair_dai_usdt,
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

          const signingKey: ethers.utils.SigningKey = new ethers.utils.SigningKey(BOB_PRIVATE_KEY)
          const sig = await getPermitBatchSignature(BATCH_PERMIT, signingKey, permit2)

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

          const signingKey: ethers.utils.SigningKey = new ethers.utils.SigningKey(BOB_PRIVATE_KEY)
          const sig = await getPermitBatchSignature(BATCH_PERMIT, signingKey, permit2)

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

          await new Promise((f) => setTimeout(f, 3000))

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

          const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner)

          expect(wethBalanceAfter).to.gt(wethBalanceBefore)
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

          const { usdcBalanceBefore, usdcBalanceAfter } = await executeRouter(planner, value)
          expect(usdcBalanceAfter).to.gt(usdcBalanceBefore)
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

          const { ethBalanceBefore, ethBalanceAfter } = await executeRouter(planner)

          expect(ethBalanceAfter).to.gt(ethBalanceBefore)
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

          const { ethBalanceBefore, ethBalanceAfter } = await executeRouter(planner)

          // TODO: permit2 test alice doesn't send more than maxAmountIn DAI
          expect(ethBalanceAfter).to.gt(ethBalanceBefore)
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
    const ethBalanceBefore: BigNumber = await provider.getBalance(bob.address)
    const wethBalanceBefore: BigNumber = await wethContract.balanceOf(bob.address)
    const daiBalanceBefore: BigNumber = await daiContract.balanceOf(bob.address)
    const usdcBalanceBefore: BigNumber = await usdcContract.balanceOf(bob.address)

    const { commands, inputs } = planner

    const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()
    const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const v2SwapEventArgs = parseEvents(V2_EVENTS, receipt)[0]?.args as unknown as V2SwapEventArgs
    const v3SwapEventArgs = parseEvents(V3_EVENTS, receipt)[0]?.args as unknown as V3SwapEventArgs

    const ethBalanceAfter: BigNumber = await provider.getBalance(bob.address)
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
