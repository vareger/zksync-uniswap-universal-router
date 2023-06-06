import { UniversalRouter, Permit2, ERC721 } from '../../typechain';
import { BigNumber, BigNumberish } from 'ethers';
import { Pair } from '@uniswap/v2-sdk';
import JSBI from 'jsbi';
import {
  ALICE_PRIVATE_KEY, OPENSEA_CONDUIT_KEY,
  
} from './shared/constants';
import NFTX_ZAP_ABI from './shared/abis/NFTXZap.json'
import { Wallet, Provider, Contract } from 'zksync-web3';

import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { deployPermit2, deployRouter} from './shared/deployUniversalRouter';

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
import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import { AdvancedOrder, getOrderParams, Order, seaportInterface, seaportOrders } from './shared/protocolHelpers/seaport';


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
  let mockLooksRareRewardsDistributor: Contract;
  let pair_DAI_WETH: Pair;
  
  let cryptoCovens: ERC721;
  let deployer: Deployer;
  let pairAddress: string;

  beforeEach(async () => {
    provider = Provider.getDefaultProvider();
    alice = new Wallet(ALICE_PRIVATE_KEY, provider);
    deployer = new Deployer(hre, alice);

    const TokenFactory = await deployer.loadArtifact("MintableERC20");
    const MockDistributorFactory = await deployer.loadArtifact('MockLooksRareRewardsDistributor');
    const MockERC20 = await deployer.loadArtifact('MockERC20');
    const UniswapV2Pair = await deployer.loadArtifact("UniswapV2Pair");
    const UniswapV2Factory = await deployer.loadArtifact("UniswapV2Factory");
    const MockSeaport = await deployer.loadArtifact('MockSeaport');    
    const MockERC721 = await deployer.loadArtifact('MockERC721');
    
    // mock rewards contracts
    mockLooksRareToken = await deployer.deploy(TokenFactory, [expandTo18DecimalsBN(5)]);
    mockLooksRareToken = new Contract(mockLooksRareToken.address, TokenFactory.abi, alice);

    mockLooksRareRewardsDistributor = await deployer.deploy(MockDistributorFactory, [ROUTER_REWARDS_DISTRIBUTOR, mockLooksRareToken.address]);
    mockLooksRareRewardsDistributor = new Contract(mockLooksRareRewardsDistributor.address, MockDistributorFactory.abi, alice);
   
    mockERC721 = await deployer.deploy(MockERC721, [alice.address]);
    mockERC721 = new Contract(mockERC721.address, MockERC721.abi, alice);
    
    
    let mockSeaport = await deployer.deploy(MockSeaport, [mockERC721.address, alice.address]);
    mockSeaport = new Contract(mockSeaport.address, MockSeaport.abi, alice);
   
    daiContract = await deployer.deploy(MockERC20, [6]);
    daiContract = new Contract(daiContract.address, MockERC20.abi, alice);
    const DAI = new Token(1, daiContract.address, 6, 'DAI', 'Dai Stablecoin');

    wethContract = await deployer.deploy(MockERC20, [18]);
    wethContract = new Contract(wethContract.address, MockERC20.abi, alice);
    const WETH = new Token(1, wethContract.address, 18, 'WETH', 'wETH ');

    let uniswapV2Factory = await deployer.deploy(UniswapV2Factory, [alice.address]);
    uniswapV2Factory = new Contract(uniswapV2Factory.address, UniswapV2Factory.abi, alice);
    
    pairAddress = await (await uniswapV2Factory.createPair(daiContract.address, wethContract.address)).wait();
    
    pairAddress = await uniswapV2Factory.getPair(daiContract.address, wethContract.address);
    let pair = new Contract(pairAddress, UniswapV2Pair.abi, alice);
    
    permit2 = (await deployPermit2()).connect(alice) as Permit2;
    router = (await deployRouter(permit2, mockSeaport.address, mockERC721.address, mockLooksRareToken.address, alice.address, mockLooksRareRewardsDistributor.address, '', '', '','','', uniswapV2Factory.address)).connect(alice) as UniversalRouter;
        

    await(await wethContract.connect(alice).mint(alice.address, '1000000000000000000000')).wait();
    await(await daiContract.connect(alice).mint(alice.address, '1000000000')).wait();

  
    
    const reserves = (await pair.getReserves())
    let reserve0: CurrencyAmount<Token> = CurrencyAmount.fromRawAmount(DAI, JSBI.BigInt(reserves[0]));
    let reserve1: CurrencyAmount<Token> = CurrencyAmount.fromRawAmount(WETH, JSBI.BigInt(reserves[1]));

    pair_DAI_WETH = new Pair(reserve0, reserve1);
    
  })

  describe('#execute', () => {
    let planner: RoutePlanner;

    beforeEach(async () => {
      planner = new RoutePlanner();


      await daiContract.mint(router.address, 1000000);
      await daiContract.mint(permit2.address, 1000000);
      await daiContract.approve(permit2.address, MAX_UINT);
      await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE);
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
      await daiContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1));
      await wethContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1));
        
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
        pair_DAI_WETH.liquidityToken.address,
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
      
        await expect((await daiContract.balanceOf(router.address)).toString()).to.be.equal('1000000000001000000');
        
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
        value = expandTo18DecimalsBN(33);
      })

      it('completes a trade for ERC20 --> ETH --> Seaport NFT', async () => {
        const maxAmountIn = expandTo18DecimalsBN(100_000);
        await(await wethContract.connect(alice).mint(router.address, expandTo18DecimalsBN(100000))).wait();
        await(await wethContract.connect(alice).mint(pairAddress, expandTo18DecimalsBN(1000000))).wait();
        await(await daiContract.connect(alice).mint(pairAddress, expandTo18DecimalsBN(1000000))).wait();
        await(await daiContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1000000))).wait();
        await(await daiContract.connect(alice).mint(pairAddress, expandTo18DecimalsBN(1000000))).wait();
        await(await daiContract.approve(permit2.address, MAX_UINT)).wait();
        await(await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)).wait();
        await(await daiContract.approve(router.address, MAX_UINT)).wait();
        await(await daiContract.approve(permit2.address, MAX_UINT)).wait();
        await(await daiContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(1000000))).wait();
        await(await wethContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(1000000))).wait();
        
        const calldata = seaportInterface.encodeFunctionData('fulfillAdvancedOrder', [
          advancedOrder,
          [],
          OPENSEA_CONDUIT_KEY,
          alice.address,
        ])

        planner = new RoutePlanner();
        planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
          ADDRESS_THIS,
          value,
          maxAmountIn,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ]);
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
