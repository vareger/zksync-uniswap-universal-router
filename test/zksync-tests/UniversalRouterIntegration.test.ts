import { UniversalRouter, ERC1155, Permit2, ERC20, MockLooksRareRewardsDistributor, ERC721 } from '../../typechain'
import { BigNumber, BigNumberish } from 'ethers'
import { Pair } from '@uniswap/v2-sdk'
import JSBI from 'jsbi'
import {
  ALICE_PRIVATE_KEY,
  BOB_PRIVATE_KEY
} from './shared/constants'

import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { Wallet, Provider, Contract } from 'zksync-web3'

import { parseEvents, V2_EVENTS, V3_EVENTS } from './shared/parseEvents'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { deployPermit2, deployRouter} from './shared/deployUniversalRouter'

import "@matterlabs/hardhat-zksync-chai-matchers";
import { expect } from 'chai';

import { abi as TOKEN_ABI } from '../../artifacts/solmate/tokens/ERC20.sol/ERC20.json'
//import NFTX_ZAP_ABI from './shared/abis/NFTXZap.json'
import deployUniversalRouter from './shared/deployUniversalRouter'
import {
  ADDRESS_THIS,
  ALICE_ADDRESS,
  DEADLINE,
  //OPENSEA_CONDUIT_KEY,
  //NFTX_COVEN_VAULT,
  //NFTX_COVEN_VAULT_ID,
  ROUTER_REWARDS_DISTRIBUTOR,
  SOURCE_MSG_SENDER,
  MAX_UINT160,
  MAX_UINT,
} from './shared/constants'
// import {
//   seaportOrders,
//   seaportInterface,
//   getOrderParams,
//   getAdvancedOrderParams,
//   AdvancedOrder,
//   Order,
//} from './shared/protocolHelpers/seaport'
//import { resetFork, WETH, DAI, COVEN_721 } from './shared/mainnetForkHelpers'
import { CommandType, RoutePlanner } from './shared/planner'
//import { makePair } from './shared/swapRouter02Helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expandTo18DecimalsBN } from './shared/helpers'
import hre from 'hardhat'
import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { deployRouterAndPermit2 } from '../integration-tests/shared/deployUniversalRouter'

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}


const { ethers } = hre
//const nftxZapInterface = new ethers.utils.Interface(NFTX_ZAP_ABI)

describe('UniversalRouter', () => {
  let provider: Provider
  let alice: Wallet
  let bob: Wallet
  let router: UniversalRouter
  let permit2: Permit2
  let daiContract: Contract
  let wethContract: Contract
  let mockLooksRareToken: Contract
  let uniswapV2Factory: Contract
  let mockERC721: Contract
  let mockLooksRareRewardsDistributor: Contract
  let pair_DAI_WETH: Pair
  
  let cryptoCovens: ERC721
  let deployer: Deployer
  let pairAddress: string

  beforeEach(async () => {
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    bob = new Wallet(BOB_PRIVATE_KEY, provider)
    deployer = new Deployer(hre, alice)

    const TokenFactory = await deployer.loadArtifact("MintableERC20")
    const MockDistributorFactory = await deployer.loadArtifact('MockLooksRareRewardsDistributor')
    const MockERC20 = await deployer.loadArtifact('MockERC20');
    const UniswapV2Pair = await deployer.loadArtifact("UniswapV2Pair");
    const UniswapV2Factory = await deployer.loadArtifact("UniswapV2Factory");
    const MockSeaport = await deployer.loadArtifact('MockSeaport');    
    const MockERC721 = await deployer.loadArtifact('MockERC721');
    
    // mock rewards contracts
    mockLooksRareToken = await deployer.deploy(TokenFactory, [expandTo18DecimalsBN(5)])
    mockLooksRareToken = new Contract(mockLooksRareToken.address, TokenFactory.abi, alice)

    mockLooksRareRewardsDistributor = await deployer.deploy(MockDistributorFactory, [ROUTER_REWARDS_DISTRIBUTOR, mockLooksRareToken.address])
    mockLooksRareRewardsDistributor = new Contract(mockLooksRareRewardsDistributor.address, MockDistributorFactory.abi, alice)
   
    mockERC721 = await deployer.deploy(MockERC721, [alice.address])
    mockERC721 = new Contract(mockERC721.address, MockERC721.abi, alice)
    
    
    let mockSeaport = await deployer.deploy(MockSeaport, [mockERC721.address, alice.address])
    mockSeaport = new Contract(mockSeaport.address, MockSeaport.abi, alice)
   
    daiContract = await deployer.deploy(MockERC20, [6])
    daiContract = new Contract(daiContract.address, MockERC20.abi, alice)
    const DAI = new Token(1, daiContract.address, 6, 'DAI', 'Dai Stablecoin')

    wethContract = await deployer.deploy(MockERC20, [18])
    wethContract = new Contract(wethContract.address, MockERC20.abi, alice)
    const WETH = new Token(1, wethContract.address, 18, 'WETH', 'wETH ')

    let uniswapV2Factory = await deployer.deploy(UniswapV2Factory, [alice.address])
    uniswapV2Factory = new Contract(uniswapV2Factory.address, UniswapV2Factory.abi, alice)
    
    
    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployRouter(permit2, mockSeaport.address, mockERC721.address, mockLooksRareToken.address, alice.address, mockLooksRareRewardsDistributor.address)).connect(alice) as UniversalRouter
        

    await wethContract.connect(alice).mint(alice.address, '1000000000000000000000')
    await daiContract.connect(alice).mint(alice.address, '1000000000')
    delay(3000)
    pairAddress = await (await uniswapV2Factory.createPair(daiContract.address, wethContract.address)).wait()
    
    delay(5000)
    pairAddress = await uniswapV2Factory.getPair(daiContract.address, wethContract.address);
    let pair = new Contract(pairAddress, UniswapV2Pair.abi, alice)
    
    const reserves = (await pair.getReserves())
    let reserve0: CurrencyAmount<Token> = CurrencyAmount.fromRawAmount(DAI, JSBI.BigInt(reserves[0]))
    let reserve1: CurrencyAmount<Token> = CurrencyAmount.fromRawAmount(WETH, JSBI.BigInt(reserves[1]))

    pair_DAI_WETH = new Pair(reserve0, reserve1);
    //pair_DAI_WETH = await makePair(alice, daiContract, wethContract)
     //const contractAddress = Pair.getAddress(daiContract, wethContract)
    // permit2 = (await deployPermit2()).connect(alice) as Permit2
    // router = (
    //   await deployUniversalRouter(permit2, mockLooksRareRewardsDistributor.address, mockLooksRareToken.address)
    // ).connect(alice) as UniversalRouter
    // cryptoCovens = COVEN_721.connect(alice) as ERC721
  })

  // describe('#execute', () => {
  //   let planner: RoutePlanner

  //   beforeEach(async () => {
  //     planner = new RoutePlanner()


  //     await daiContract.mint(router.address, 1000000)
  //     await daiContract.mint(permit2.address, 1000000)
  //     await daiContract.approve(permit2.address, MAX_UINT)
  //     await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)
  //   })

  //   it('reverts if block.timestamp exceeds the deadline', async () => {
  //     planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
  //       alice.address,
  //       1,
  //       1,
  //       [daiContract.address, wethContract.address],
  //       SOURCE_MSG_SENDER,
  //     ])
  //     const invalidDeadline = 10
  //     await daiContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1))
  //     await wethContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1))
        
  //     const { commands, inputs } = planner

  //     await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, invalidDeadline)).to.be.revertedWithCustomError(router, 'TransactionDeadlinePassed');
        
  //   })

  //   it('reverts for an invalid command at index 0', async () => {
  //     const commands = '0xff'
  //     const inputs: string[] = ['0x12341234']

  //     await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.be.revertedWithCustomError(router, 
  //       'InvalidCommandType'
  //     )
  //   })

  //   it('reverts for an invalid command at index 1', async () => {
  //     const invalidCommand = 'ff'
  //     planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
  //       daiContract.address,
  //       pair_DAI_WETH.liquidityToken.address,
  //       expandTo18DecimalsBN(1),
  //     ])
  //     let commands = planner.commands
  //     let inputs = planner.inputs

  //     commands = commands.concat(invalidCommand)
  //     inputs.push('0x21341234')
      
  //     await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.be.reverted;
  //   })

  //   it('reverts if paying a portion over 100% of contract balance', async () => {
  //     await daiContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1))
        
  //       await delay(3000);
  //       await expect((await daiContract.balanceOf(router.address)).toString()).to.be.equal('1000000000001000000');
        
  //       planner = new RoutePlanner();
  //       planner.addCommand(CommandType.PAY_PORTION, [daiContract.address, alice.address, 11_000])
      
  //       planner.addCommand(CommandType.SWEEP, [daiContract.address, alice.address, expandTo18DecimalsBN(2)])
  //       const { commands, inputs } = planner
  //       await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(router, 'InvalidBips');
  //   })
  // })
  //   describe('partial fills', async () => {
  //     let nftxValue: BigNumber
  //     let numCovens: number
  //     let value: BigNumber
  //     let invalidSeaportCalldata: string
  //     let seaportValue: BigNumber
  //     let planner: RoutePlanner


  //     beforeEach(async () => {
  //       // add valid nftx order to planner
  //       nftxValue = expandTo18DecimalsBN(4)
  //       numCovens = 2
  //       const calldata = '0x7fc82484000000000000000000000000000000000000000000000000000000000000014d000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000f977814e90da44bfa03b6295a0616a897441acec00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000d89b16331f39ab3878daf395052851d3ac8cf3cd';
  //       planner = new RoutePlanner();
  //       planner.addCommand(CommandType.NFTX, [nftxValue, calldata])

  //       invalidSeaportCalldata = '0xb3a34c4c00000000000000000000000000000000000000000000000000000000000000400000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000004c00000000000000000000000000f1fcc9da5db6753c90fbeb46024c056516fbc17000000000000000000000000004c00500000ad104d7dbd00e3ae0a5c00560c000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000062c8c8590000000000000000000000000000000000000000000000000000000063b6246900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b2ac118e60420000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f00000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000005180db8f5c931aae63c74266b211f580155ecac8000000000000000000000000000000000000000000000000000000000000204f000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a79e95c588cc8000000000000000000000000000000000000000000000000001a79e95c588cc80000000000000000000000000000f1fcc9da5db6753c90fbeb46024c056516fbc170000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b72fd2103b280000000000000000000000000000000000000000000000000000b72fd2103b280000000000000000000000000008de9c5a032463c561423387a9648c5c7bcc5bc9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000016e5fa420765000000000000000000000000000000000000000000000000000016e5fa4207650000000000000000000000000000ac9d54ca08740a608b6c474e5ca07d51ca8117fa0000000000000000000000000000000000000000000000000000000000000004deadbeef00000000000000000000000000000000000000000000000000000000';
        
  //       value = BigNumber.from('37000000000000000000') 
  //       seaportValue = BigNumber.from('33000000000000000000')
  //     })

  //     it('reverts if no commands are allowed to revert', async () => {
  //       planner = new RoutePlanner();
        
  //       planner.addCommand(CommandType.SEAPORT, [seaportValue, invalidSeaportCalldata])
  //       const { commands, inputs } = planner
        
  //       await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, {value})).to.be.revertedWithCustomError(router, 'ExecutionFailed');
        
  //     })

  //     it('does not revert if invalid seaport transaction allowed to fail', async () => {
  //       planner = new RoutePlanner();
  //       nftxValue = expandTo18DecimalsBN(4)
  //       numCovens = 2
  //       const calldata = '0x7fc82484000000000000000000000000000000000000000000000000000000000000014d000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000f977814e90da44bfa03b6295a0616a897441acec00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000d89b16331f39ab3878daf395052851d3ac8cf3cd';
        
  //       planner.addCommand(CommandType.NFTX, [nftxValue, calldata]);
  //       planner.addCommand(CommandType.SEAPORT, [seaportValue, invalidSeaportCalldata], true)
  //       const { commands, inputs } = planner
  //       let value1 = BigNumber.from('37000000000000000000')   
  //       const covenBalanceBefore = await mockERC721.balanceOf(alice.address)
  //       await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value1 })).wait()
  //       console.log("covenBalanceBefore ",covenBalanceBefore)
  //       const covenBalanceAfter = await mockERC721.balanceOf(alice.address)
  //       console.log("covenBalanceAfter ",covenBalanceAfter)
  //       expect(covenBalanceAfter.sub(covenBalanceBefore)).to.eq(numCovens)
  //     })
  //   })

    describe('ERC20 --> NFT', () => {
      let value: BigNumber
      let planner: RoutePlanner

      beforeEach(async () => {
        value = expandTo18DecimalsBN(33)
      })

      it('completes a trade for ERC20 --> ETH --> Seaport NFT', async () => {
        const maxAmountIn = expandTo18DecimalsBN(100_000)
        await(await wethContract.connect(alice).mint(router.address, expandTo18DecimalsBN(100000))).wait()
        await(await wethContract.connect(alice).mint(pairAddress, expandTo18DecimalsBN(1000000))).wait()
        await(await daiContract.connect(alice).mint(pairAddress, expandTo18DecimalsBN(1000000))).wait()
        await(await daiContract.connect(alice).mint(router.address, expandTo18DecimalsBN(1000000))).wait()
        await(await daiContract.connect(alice).mint(pairAddress, expandTo18DecimalsBN(1000000))).wait()
        await(await daiContract.approve(permit2.address, MAX_UINT)).wait()
        await(await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)).wait()
        await(await daiContract.approve(router.address, MAX_UINT)).wait()
        await(await daiContract.approve(permit2.address, MAX_UINT)).wait()
        await(await daiContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(1000000))).wait()
        await(await wethContract.connect(alice).mint(alice.address, expandTo18DecimalsBN(1000000))).wait()
        
        const calldata = "0xe7acab24000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000006600000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000000000000000000000000000f977814e90da44bfa03b6295a0616a897441acec00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000052000000000000000000000000000000000000000000000000000000000000005a00000000000000000000000000f1fcc9da5db6753c90fbeb46024c056516fbc17000000000000000000000000004c00500000ad104d7dbd00e3ae0a5c00560c000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000062c8c8590000000000000000000000000000000000000000000000000000000063b6246900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b2ac118e60420000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f00000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000005180db8f5c931aae63c74266b211f580155ecac8000000000000000000000000000000000000000000000000000000000000204f000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a79e95c588cc8000000000000000000000000000000000000000000000000001a79e95c588cc80000000000000000000000000000f1fcc9da5db6753c90fbeb46024c056516fbc170000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b72fd2103b280000000000000000000000000000000000000000000000000000b72fd2103b280000000000000000000000000008de9c5a032463c561423387a9648c5c7bcc5bc9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000016e5fa420765000000000000000000000000000000000000000000000000000016e5fa4207650000000000000000000000000000ac9d54ca08740a608b6c474e5ca07d51ca8117fa000000000000000000000000000000000000000000000000000000000000004158073c305ffa6daf8b6279050d9837d88040350a004efe3028fd6cda8aef41cd0819bb209b6ef3b3d6df717180677a3916c15ea669f8251471d3d39ee6abdac31b00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        
        planner = new RoutePlanner();
        planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
          ADDRESS_THIS,
          value,
          maxAmountIn,
          [daiContract.address, wethContract.address],
          SOURCE_MSG_SENDER,
        ])
        //planner.addCommand(CommandType.UNWRAP_WETH, [ADDRESS_THIS, value])
        //planner.addCommand(CommandType.SEAPORT, [value.toString(), calldata])
        const { commands, inputs } = planner
        //const covenBalanceBefore = await cryptoCovens.balanceOf(alice.address)
        await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, {value})).to.be.revertedWithCustomError(router, 'ExecutionFailed');
        //const covenBalanceAfter = await cryptoCovens.balanceOf(alice.address)
        //expect(covenBalanceAfter.sub(covenBalanceBefore)).to.eq(1)
      })
    })
  

  // describe('#collectRewards', () => {
  //   let amountRewards: BigNumberish
  //   beforeEach(async () => {
  //     amountRewards = expandTo18DecimalsBN(0.5)
  //     await (await mockLooksRareToken.connect(alice).transfer(mockLooksRareRewardsDistributor.address, amountRewards)).wait()
  //   })

  //   it('transfers owed rewards into the distributor contract', async () => {
  //     const balanceBefore = await mockLooksRareToken.balanceOf(ROUTER_REWARDS_DISTRIBUTOR)
      
  //     await (await router.collectRewards('0x00')).wait()
  //     const balanceAfter = await mockLooksRareToken.balanceOf(ROUTER_REWARDS_DISTRIBUTOR)
  //     expect(balanceAfter.sub(balanceBefore)).to.eq(amountRewards)
  //   })
  // })


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
  ethBalanceBefore: BigNumber
  ethBalanceAfter: BigNumber
  v2SwapEventArgs: V2SwapEventArgs | undefined
  v3SwapEventArgs: V3SwapEventArgs | undefined
  receipt: TransactionReceipt
  gasSpent: BigNumber
}

async function executeRouter(planner: RoutePlanner, value?: BigNumberish): Promise<ExecutionParams> {
  const ethBalanceBefore: BigNumber = await ethers.provider.getBalance(alice.address)
  const wethBalanceBefore: BigNumber = await wethContract.balanceOf(alice.address)
  const daiBalanceBefore: BigNumber = await daiContract.balanceOf(alice.address)

  const { commands, inputs } = planner

  const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()
  const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
  const v2SwapEventArgs = parseEvents(V2_EVENTS, receipt)[0]?.args as unknown as V2SwapEventArgs
  const v3SwapEventArgs = parseEvents(V3_EVENTS, receipt)[0]?.args as unknown as V3SwapEventArgs

  const ethBalanceAfter: BigNumber = await ethers.provider.getBalance(bob.address)
  const wethBalanceAfter: BigNumber = await wethContract.balanceOf(bob.address)
  const daiBalanceAfter: BigNumber = await daiContract.balanceOf(bob.address)

  return {
    wethBalanceBefore,
    wethBalanceAfter,
    daiBalanceBefore,
    daiBalanceAfter,
    ethBalanceBefore,
    ethBalanceAfter,
    v2SwapEventArgs,
    v3SwapEventArgs,
    receipt,
    gasSpent,
  }
}
})
