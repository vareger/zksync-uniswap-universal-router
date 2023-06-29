import { CommandType, RoutePlanner } from './shared/planner';
import { UniversalRouter, Permit2 } from '../../typechain';
import { 
    ALICE_ADDRESS, 
    ALICE_PRIVATE_KEY,
    BOB_PRIVATE_KEY,
    DEADLINE, 
    MAX_UINT, 
    ZERO_ADDRESS
} from './shared/constants';
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter';
import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import { X2Y2Order, x2y2Orders, X2Y2_INTERFACE } from './shared/protocolHelpers/x2y2';
import { Wallet, Provider, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { expandTo6DecimalsBN , expandTo18DecimalsBN} from './shared/helpers';
import { BigNumber } from 'ethers'
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { getMaxTick, getMinTick } from './shared/ticks'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import bn from 'bignumber.js'
import { POOL_BYTECODE_HASH, computePoolAddress } from './shared/computePoolAddress';

describe('UniswapV3', () => {
  let provider: Provider;
  let alice: Wallet;
  let bob: Wallet;
  let weth: Contract;
  let usdc: Contract
  let dai: Contract;
  let uniswapV3Factory: Contract;
  let swapRouter: Contract;
  let nonfungibleTokenPositionDescriptor: Contract;
  let nonfungiblePositionManager: Contract;
  let nftDescriptor: Contract;

  let planner: RoutePlanner;

  before(async () => {

    provider = Provider.getDefaultProvider();
    alice = new Wallet(ALICE_PRIVATE_KEY, provider);
    bob = new Wallet(BOB_PRIVATE_KEY, provider);
    let deployer = new Deployer(hre, alice);

    const MockL2WETH = await deployer.loadArtifact("MockL2WETH");
    const MockERC20 = await deployer.loadArtifact("MockERC20")
    const UniswapV3Factory = await deployer.loadArtifact("UniswapV3Factory");
    const SwapRouter = await deployer.loadArtifact("SwapRouter");
    const NonfungibleTokenPositionDescriptor = await deployer.loadArtifact("NonfungibleTokenPositionDescriptor")
    const NonfungiblePositionManager = await deployer.loadArtifact("NonfungiblePositionManager");
    const NFTDescriptor = await deployer.loadArtifact("NFTDescriptor");

    weth = await deployer.deploy(MockL2WETH, []) as Contract;
    usdc = await deployer.deploy(MockERC20, [6]) as Contract;
    dai = await deployer.deploy(MockERC20, [18]) as Contract;
    uniswapV3Factory = await deployer.deploy(UniswapV3Factory, []) as Contract;
    swapRouter = await deployer.deploy(SwapRouter, [uniswapV3Factory.address, weth.address]) as Contract;
    nonfungibleTokenPositionDescriptor = await deployer.deploy(NonfungibleTokenPositionDescriptor, [weth.address]) as Contract;
    nonfungiblePositionManager = await deployer.deploy(NonfungiblePositionManager, 
    [
      uniswapV3Factory.address, 
      weth.address, 
      nonfungibleTokenPositionDescriptor.address
    ]) as Contract;
    nftDescriptor = await deployer.deploy(NFTDescriptor, [])
    console.log("WETH: " + weth.address)
    console.log("USDC: " + usdc.address)
    console.log("DAI:  " + dai.address)
    console.log("uniswapV3Factory: " + uniswapV3Factory.address)
    console.log("swapRouter:       " + swapRouter.address)
    console.log("nonfungibleTokenPositionDescriptor: " + nonfungibleTokenPositionDescriptor.address)
    console.log("nonfungiblePositionManager: " + nonfungiblePositionManager.address)
    console.log("nftDescriptor: " + nftDescriptor.address)
    
    // hre.config.UNISWAPV3_COMPILER_SETTINGS.settings.libraries = {
    //   "lib/v3-periphery/contracts/libraries/NFTDescriptor.sol" : {
    //     NFTDescriptor: nftDescriptor.address
    //   },
    // }
    // await hre.run('compile')

    await (await weth.connect(alice).deposit({value: expandTo18DecimalsBN(11100)})).wait();
    await (await usdc.connect(alice).mint(alice.address, expandTo6DecimalsBN(200_000_000))).wait();
    await (await dai.connect(alice).mint(alice.address, expandTo18DecimalsBN(200_000_000))).wait();
  })

  it('POOL bytecode hash', async () => {
    console.log("POOL BYTECODE HASH:")
    console.log(POOL_BYTECODE_HASH)
    // console.log(computePoolAddress(uniswapV3Factory.address, ))
  })

  it('add liquidity', async () => {

    await (await weth.connect(alice).approve(nonfungiblePositionManager.address, MAX_UINT)).wait()
    await (await dai.connect(alice).approve(nonfungiblePositionManager.address, MAX_UINT)).wait()

    let tokenAddressA = weth.address
    let tokenAddressB = dai.address

    if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase()) {
      [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]
    }

    const poolBefore = await uniswapV3Factory.getPool(weth.address, dai.address, FeeAmount.MEDIUM)
    console.log("Pool before: " + poolBefore)

    await (await nonfungiblePositionManager.connect(alice).createAndInitializePoolIfNecessary(
      tokenAddressA,
      tokenAddressB,
      FeeAmount.MEDIUM,
      encodePriceSqrt(1, 1)
    )).wait()

    const poolAfter = await uniswapV3Factory.getPool(weth.address, dai.address, FeeAmount.MEDIUM)
    console.log("Pool after: " + poolAfter)
      
    let mintParams = {
      token0 : tokenAddressA,
      token1 : tokenAddressB,
      fee : FeeAmount.MEDIUM,
      tickLower : getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper : getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      amount0Desired : expandTo6DecimalsBN(10_000_000),
      amount1Desired : expandTo6DecimalsBN(10_000_000),
      amount0Min : expandTo6DecimalsBN(10_000_000),
      amount1Min : expandTo6DecimalsBN(10_000_000),
      recipient : alice.address,
      deadline : DEADLINE
    }
    await (await nonfungiblePositionManager.connect(alice).mint(mintParams)).wait()


  
  })

  it('', async () => {

  })
})