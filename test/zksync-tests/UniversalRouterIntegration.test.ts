import { UniversalRouter, Permit2, ERC721, UniswapV2Factory, UniswapV2Router02 } from '../../typechain';
import { BigNumber, BigNumberish } from 'ethers';
import { Pair } from '@uniswap/v2-sdk';
import JSBI from 'jsbi';
import {
  ALICE_PRIVATE_KEY, CONTRACT_BALANCE, OPENSEA_CONDUIT_KEY, ZERO_ADDRESS,
  
} from './shared/constants';
import NFTX_ZAP_ABI from './shared/abis/NFTXZap.json'
import { Wallet, Provider, Contract } from 'zksync-web3';

import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { deployPermit2, deployRouter} from './shared/deployUniversalRouter';
import {deployUniswapV2} from './shared/deployUniswapV2'

import "@matterlabs/hardhat-zksync-chai-matchers";
import { expect } from 'chai';

import {
  ADDRESS_THIS,
  DEADLINE,
  ROUTER_REWARDS_DISTRIBUTOR,
  SOURCE_MSG_SENDER,
  NFTX_COVEN_VAULT,
  NFTX_COVEN_VAULT_ID,
  MAX_UINT160,
  MAX_UINT,
} from './shared/constants';

import { CommandType, RoutePlanner } from './shared/planner';
import { expandTo18DecimalsBN } from './shared/helpers';
import hre from 'hardhat';
import { 
  AdvancedOrder, 
  getOrderParams, 
  Order, 
  getAdvancedOrderParams,
  seaportInterface, 
  seaportOrders 
} from './shared/protocolHelpers/seaport';


const { ethers } = hre;
const nftxZapInterface = new ethers.utils.Interface(NFTX_ZAP_ABI);



describe('UniversalRouter', () => {
  let provider: Provider;
  let alice: Wallet;
  let router: UniversalRouter;
  let permit2: Permit2;
  let daiContract: Contract;
  let wethContract: Contract;
  let mockLooksRareToken: Contract;
  let mockERC721: Contract;
  let mockSeaport: Contract;
  let mockLooksRareRewardsDistributor: Contract;
  let pair_DAI_WETH: string;

  let uniswapV2Factory: UniswapV2Factory
  let uniswapV2Router: UniswapV2Router02
  
  let cryptoCovens: ERC721;
  let deployer: Deployer;
  let pairAddress: string;

  before(async() => {

    provider = Provider.getDefaultProvider();
    alice = new Wallet(ALICE_PRIVATE_KEY, provider);
    deployer = new Deployer(hre, alice);

    const MockL2WETH = await deployer.loadArtifact("MockL2WETH")
    const MintableERC20 = await deployer.loadArtifact("MintableERC20");
    const MockLooksRareRewardsDistributor = await deployer.loadArtifact('MockLooksRareRewardsDistributor');
    const MockCryptoCovens = await deployer.loadArtifact("MockCryptoCovens")
    const MockSeaport = await deployer.loadArtifact('MockSeaport3');    
    const MockERC721 = await deployer.loadArtifact('MockERC721');

    cryptoCovens = await deployer.deploy(MockCryptoCovens, [alice.address]) as unknown as ERC721

    // mock rewards contracts
    mockLooksRareToken = await deployer.deploy(MintableERC20, [expandTo18DecimalsBN(5)]);
    mockLooksRareToken = new Contract(mockLooksRareToken.address, MintableERC20.abi, alice);

    mockLooksRareRewardsDistributor = await deployer.deploy(MockLooksRareRewardsDistributor, [ROUTER_REWARDS_DISTRIBUTOR, mockLooksRareToken.address]);
    mockLooksRareRewardsDistributor = new Contract(mockLooksRareRewardsDistributor.address, MockLooksRareRewardsDistributor.abi, alice);

    daiContract = await deployer.deploy(MintableERC20, [expandTo18DecimalsBN(900_000)]) as Contract
   
    wethContract = await deployer.deploy(MockL2WETH, []) as Contract
   
    const uniswapV2 = await deployUniswapV2(wethContract.address)

    uniswapV2Factory = uniswapV2[0]
    uniswapV2Router = uniswapV2[1]

    let tokenA = daiContract.address
    let tokenB = wethContract.address
    let amountADesired = expandTo18DecimalsBN(10_000_000)
    let amountBDesired = expandTo18DecimalsBN(100_000)
    let amountAMin = amountADesired
    let amountBMin = amountBDesired
    let to = alice.address
    let deadline = Math.round((new Date()).getTime()/1000)+86400;
    await (await daiContract.connect(alice).mint(alice.address, amountADesired)).wait()
    await (await wethContract.connect(alice).deposit({value: amountBDesired})).wait()

    await (await daiContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()
    await (await wethContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait()

    await (await uniswapV2Router.connect(alice).addLiquidity(
        tokenA,
        tokenB,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        to,
        deadline
    )).wait()

    let reserves = await uniswapV2Router.getReserves(tokenA, tokenB)

    expect(reserves[0]).to.be.eq(amountADesired)
    expect(reserves[1]).to.be.eq(amountBDesired)

    pairAddress = await uniswapV2Factory.getPair(daiContract.address, wethContract.address);
    console.log("pairAddress: " + pairAddress)
    pair_DAI_WETH = pairAddress

    mockERC721 = await deployer.deploy(MockERC721, [alice.address]) as Contract
    
    mockSeaport = await deployer.deploy(MockSeaport, [cryptoCovens.address, alice.address]) as Contract;
   
    permit2 = (await deployPermit2()).connect(alice) as Permit2;
    router = (await deployRouter(
      permit2, 
      wethContract.address, //weth9
      mockSeaport.address,  // seaport
      mockERC721.address,  //nftxzap
      ZERO_ADDRESS, // x2y2
      ZERO_ADDRESS, // foundation
      ZERO_ADDRESS, // sudoswap
      ZERO_ADDRESS, // nft20zap
      ZERO_ADDRESS, // cryptopunks
      ZERO_ADDRESS, // looksRare 
      alice.address,  // routerRewardsDistributor
      mockLooksRareRewardsDistributor.address, //looksRareRewardsDistributor 
      mockLooksRareToken.address, // looksRareTokenAddress
      uniswapV2Factory.address, // v2FactoryAddress
      ZERO_ADDRESS, // uniswapV3
    )).connect(alice) as UniversalRouter;

    await(await daiContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(1_000_000_000))).wait();
    await(await wethContract.connect(alice).deposit({value: expandTo18DecimalsBN(1_000_000)})).wait();
  })

  describe('#execute', () => {
    let planner: RoutePlanner;

    beforeEach(async () => {
      planner = new RoutePlanner();


      await daiContract.mint(router.address, 1000000);
      await daiContract.mint(permit2.address, 1000000);
      await daiContract.approve(permit2.address, MAX_UINT);
      await wethContract.approve(permit2.address, MAX_UINT);
      await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE);
      await permit2.approve(wethContract.address, router.address, MAX_UINT160, DEADLINE);
    })

    it('reverts if block.timestamp exceeds the deadline', async () => {
      planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
        alice.address,
        1,
        1,
        [daiContract.address, wethContract.address],
        SOURCE_MSG_SENDER,
      ]);
      const invalidDeadline = 10
      await (await daiContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1))).wait();
      await (await wethContract.connect(alice).deposit({value: expandTo18DecimalsBN(1)})).wait();
      await (await wethContract.connect(alice).transfer(router.address, expandTo18DecimalsBN(1))).wait();
        
      const { commands, inputs } = planner;

      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, invalidDeadline)).to.be.revertedWithCustomError(router, 'TransactionDeadlinePassed');
        
    })

    it('reverts for an invalid command at index 0', async () => {
      const commands = '0xff';
      const inputs: string[] = ['0x12341234'];

      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.be.revertedWithCustomError(router, 
        'InvalidCommandType'
      );
    })

    it('reverts for an invalid command at index 1', async () => {
      const invalidCommand = 'ff';
      planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
        daiContract.address,
        pair_DAI_WETH,
        expandTo18DecimalsBN(1),
      ]);
      let commands = planner.commands;
      let inputs = planner.inputs;

      commands = commands.concat(invalidCommand);
      inputs.push('0x21341234');
      
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.be.reverted;
    })

    it('reverts if paying a portion over 100% of contract balance', async () => {
        await(await daiContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1))).wait();
              
        planner = new RoutePlanner();
        planner.addCommand(CommandType.PAY_PORTION, [daiContract.address, alice.address, 11_000]);
      
        planner.addCommand(CommandType.SWEEP, [daiContract.address, alice.address, expandTo18DecimalsBN(2)]);
        const { commands, inputs } = planner
        await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(router, 'InvalidBips');
    })
  })
  
  describe('partial fills', async () => {
    let nftxValue: BigNumber;
    let numCovens: number;
    let value: BigNumber;
    let invalidSeaportCalldata: string;
    let seaportValue: BigNumber;
    let planner: RoutePlanner;


    beforeEach(async () => {
      // add valid nftx order to planner
      nftxValue = expandTo18DecimalsBN(4);
      numCovens = 2;
      const calldata = nftxZapInterface.encodeFunctionData('buyAndRedeem', [
        NFTX_COVEN_VAULT_ID,
        numCovens,
        [],
        [daiContract.address, NFTX_COVEN_VAULT],
        alice.address,
      ])
      planner = new RoutePlanner();
      planner.addCommand(CommandType.NFTX, [nftxValue, calldata]);

      let invalidSeaportOrder = JSON.parse(JSON.stringify(seaportOrders[0]));
      invalidSeaportOrder.protocol_data.signature = '0xdeadbeef';
      let seaportOrder: Order;
      ;({ order: seaportOrder, value: seaportValue } = getOrderParams(invalidSeaportOrder));
      invalidSeaportCalldata = seaportInterface.encodeFunctionData('fulfillOrder', [
        seaportOrder,
        OPENSEA_CONDUIT_KEY,
      ]);
      
      value = BigNumber.from('37000000000000000000');
      seaportValue = BigNumber.from('33000000000000000000');
    })

    it('reverts if no commands are allowed to revert', async () => {
      
      
      planner.addCommand(CommandType.SEAPORT, [seaportValue, invalidSeaportCalldata]);
      const { commands, inputs } = planner;
      
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, {value})).to.be.revertedWithCustomError(router, 'ExecutionFailed');
      
    })

    it('does not revert if invalid seaport transaction allowed to fail', async () => {
      
      planner.addCommand(CommandType.SEAPORT, [seaportValue, invalidSeaportCalldata], true);
      const { commands, inputs } = planner;
      let value1 = BigNumber.from('37000000000000000000');
      const covenBalanceBefore = await mockERC721.balanceOf(alice.address);
      await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value1 })).wait();
      const covenBalanceAfter = await mockERC721.balanceOf(alice.address);
      expect(covenBalanceAfter.sub(covenBalanceBefore)).to.eq(numCovens);
    })
  })

  describe('ERC20 --> NFT', () => {
    let value: BigNumber;
    let advancedOrder: AdvancedOrder
    let planner: RoutePlanner;

    beforeEach(async () => {
      ;({ advancedOrder, value } = getAdvancedOrderParams(seaportOrders[0]))
    })

    it('completes a trade for ERC20 --> ETH --> Seaport NFT', async () => {
      const maxAmountIn = expandTo18DecimalsBN(100_000);
    
      const calldata = seaportInterface.encodeFunctionData('fulfillAdvancedOrder', [
        advancedOrder,
        [],
        OPENSEA_CONDUIT_KEY,
        alice.address,
      ])

     
      await (await daiContract.connect(alice).approve(router.address, maxAmountIn)).wait()
      await (await permit2.connect(alice).approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)).wait()
      
      await (await daiContract.mint(router.address, expandTo18DecimalsBN(1_000_000))).wait()

      planner = new RoutePlanner();
      planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
        ADDRESS_THIS,
        value,
        maxAmountIn,
        [daiContract.address, wethContract.address],
        SOURCE_MSG_SENDER,
      ])
      planner.addCommand(CommandType.UNWRAP_WETH, [ADDRESS_THIS, value]);
      planner.addCommand(CommandType.SEAPORT, [value.toString(), calldata]);
      const { commands, inputs } = planner;
      const covenBalanceBefore = await cryptoCovens.balanceOf(alice.address);
      await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, {value})).wait();
      const covenBalanceAfter = await cryptoCovens.balanceOf(alice.address);
      expect(covenBalanceAfter.sub(covenBalanceBefore)).to.eq(1);
    })
  })
  

  describe('#collectRewards', () => {
    let amountRewards: BigNumberish;
    beforeEach(async () => {
      amountRewards = expandTo18DecimalsBN(0.5);
      await (await mockLooksRareToken.connect(alice).transfer(mockLooksRareRewardsDistributor.address, amountRewards)).wait();
    })

    it('transfers owed rewards into the distributor contract', async () => {
      const balanceBefore = await mockLooksRareToken.balanceOf(ROUTER_REWARDS_DISTRIBUTOR);

      await (await router.collectRewards('0x00')).wait();
      const balanceAfter = await mockLooksRareToken.balanceOf(ROUTER_REWARDS_DISTRIBUTOR);
      expect(balanceAfter.sub(balanceBefore)).to.eq(amountRewards);
    })
  })



})
