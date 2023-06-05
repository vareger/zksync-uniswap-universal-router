import FOUNDATION_ABI from './shared/abis/Foundation.json'
import { UniversalRouter, Permit2, MockSeaport } from '../../typechain'
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter'
import { ALICE_PRIVATE_KEY, BOB_PRIVATE_KEY, ALICE_ADDRESS, DEADLINE, OPENSEA_CONDUIT_KEY, ETH_ADDRESS} from './shared/constants'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import hre from 'hardhat'
import { BigNumber } from 'ethers'
import { Wallet, Provider, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { expect } from 'chai'
import {
  seaportOrders,
  seaportInterface,
  getAdvancedOrderParams,
  purchaseDataForTwoCovensSeaport,
} from './shared/protocolHelpers/seaport'
import "@matterlabs/hardhat-zksync-chai-matchers";
import { CommandType, RoutePlanner } from './shared/planner'
const { ethers } = hre

describe('Seaport', () => {
  let provider: Provider
  let alice: Wallet
  let bob: Wallet
  let router: Contract
  let permit2: Permit2
  let planner: RoutePlanner
  let deployer: Deployer
  let mockERC721: Contract
  let mockSeaport: Contract
  let mockFoundation: Contract


  beforeEach(async () => {
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    bob = new Wallet(BOB_PRIVATE_KEY, provider)
    deployer = new Deployer(hre, alice)

    const MockERC721 = await deployer.loadArtifact('MockERC721');
    const MockSeaport = await deployer.loadArtifact('MockSeaport');    

    mockERC721 = await deployer.deploy(MockERC721, [alice.address])
    mockERC721 = new Contract(mockERC721.address, MockERC721.abi, alice)
    
    mockSeaport = await deployer.deploy(MockSeaport, [mockERC721.address, alice.address])
    mockSeaport = new Contract(mockSeaport.address, MockSeaport.abi, alice)
   
   
    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployUniversalRouter(permit2, mockSeaport.address)).connect(alice) as UniversalRouter
    planner = new RoutePlanner()
    
    //cryptoCovens = COVEN_721.connect(alice) as ERC721
  })

  it('completes a fulfillAdvancedOrder type', async () => {
    const { advancedOrder, value } = getAdvancedOrderParams(seaportOrders[0])
    const params = advancedOrder.parameters
    const calldata = seaportInterface.encodeFunctionData('fulfillAdvancedOrder', [
      advancedOrder,
      [],
      OPENSEA_CONDUIT_KEY,
      alice.address,
    ])

    planner.addCommand(CommandType.SEAPORT, [value.toString(), calldata])
    const { commands, inputs } = planner
    await(await mockERC721.connect(alice).mint("0x0f1fcc9da5db6753c90fbeb46024c056516fbc17", 8271)).wait()
    const ownerBefore = await mockERC721.ownerOf(params.offer[0].identifierOrCriteria)

    
    //const ethBefore = await ethers.provider.getBalance(alice.address)
    const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()
    const ownerAfter = await mockERC721.ownerOf(params.offer[0].identifierOrCriteria)
    //const ethAfter = await ethers.provider.getBalance(alice.address)
    //const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    //const ethDelta = ethBefore.sub(ethAfter)

    expect(ownerBefore.toLowerCase()).to.eq(params.offerer)
    expect(ownerAfter).to.eq(alice.address)
    //expect(ethDelta.sub(gasSpent)).to.eq(value)
  })

  it('revertable fulfillAdvancedOrder reverts and sweeps ETH', async () => {
    
    let { advancedOrder, value } = getAdvancedOrderParams(seaportOrders[0])
    const params = advancedOrder.parameters
    const calldata = seaportInterface.encodeFunctionData('fulfillAdvancedOrder', [
      advancedOrder,
      [],
      OPENSEA_CONDUIT_KEY,
      alice.address,
    ])

    // Allow seaport to revert
    planner.addCommand(CommandType.SEAPORT, [value.toString(), calldata], true)
    planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, alice.address, 0])

    const commands = planner.commands
    const inputs = planner.inputs
    await(await mockERC721.connect(alice).mint("0x0f1fcc9da5db6753c90fbeb46024c056516fbc17", params.offer[0].identifierOrCriteria)).wait()
    
    const ownerBefore = await mockERC721.ownerOf(params.offer[0].identifierOrCriteria)
    //const ethBefore = await ethers.provider.getBalance(alice.address)

    // don't send enough ETH, so the seaport purchase reverts
    value = BigNumber.from(value).sub('1')
    const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()

    const ownerAfter = await mockERC721.ownerOf(params.offer[0].identifierOrCriteria)
    //const ethAfter = await ethers.provider.getBalance(alice.address)
    //const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    //const ethDelta = ethBefore.sub(ethAfter)

    // The owner was unchanged, the user got the eth back
    expect(ownerBefore.toLowerCase()).to.eq(ownerAfter.toLowerCase())
    //expect(ethDelta).to.eq(gasSpent)
  })

  it('completes a fulfillAvailableAdvancedOrders type', async () => {
    const { calldata, advancedOrder0, advancedOrder1, value } = purchaseDataForTwoCovensSeaport(alice.address)
    const params0 = advancedOrder0.parameters
    const params1 = advancedOrder1.parameters
    planner.addCommand(CommandType.SEAPORT, [value.toString(), calldata])
    const { commands, inputs } = planner

    await(await mockERC721.connect(alice).mint(params0.offerer, params0.offer[0].identifierOrCriteria)).wait()
    await(await mockERC721.connect(alice).mint(params1.offerer, params1.offer[0].identifierOrCriteria)).wait()
    
    const owner0Before = await mockERC721.ownerOf(params0.offer[0].identifierOrCriteria)
    const owner1Before = await mockERC721.ownerOf(params1.offer[0].identifierOrCriteria)
    //const ethBefore = await ethers.provider.getBalance(alice.address)

    const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()

    const owner0After = await mockERC721.ownerOf(params0.offer[0].identifierOrCriteria)
    const owner1After = await mockERC721.ownerOf(params1.offer[0].identifierOrCriteria)
    //const ethAfter = await ethers.provider.getBalance(alice.address)
    // const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    // const ethDelta = ethBefore.sub(ethAfter)

    expect(owner0Before.toLowerCase()).to.eq(params0.offerer)
    expect(owner1Before.toLowerCase()).to.eq(params1.offerer)
    expect(owner0After).to.eq(alice.address)
    expect(owner1After).to.eq(alice.address)
    //expect(ethDelta.sub(gasSpent)).to.eq(value)
  })

  it('reverts if order does not go through', async () => {
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    bob = new Wallet(BOB_PRIVATE_KEY, provider)
    deployer = new Deployer(hre, alice)

    const MockERC721 = await deployer.loadArtifact('MockERC721');
    const MockSeaportRevert = await deployer.loadArtifact('MockSeaportRevert');    

    mockERC721 = await deployer.deploy(MockERC721, [alice.address])
    mockERC721 = new Contract(mockERC721.address, MockERC721.abi, alice)
    
    let mockSeaport = await deployer.deploy(MockSeaportRevert, [mockERC721.address, alice.address])
    mockSeaport = new Contract(mockSeaport.address, MockSeaportRevert.abi, alice)
   
   
    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployUniversalRouter(permit2, mockSeaport.address)).connect(alice) as UniversalRouter
    planner = new RoutePlanner()

    let invalidSeaportOrder = JSON.parse(JSON.stringify(seaportOrders[0]))
    invalidSeaportOrder.protocol_data.signature = '0xdeadbeef'
    const { advancedOrder: seaportOrder, value: seaportValue } = getAdvancedOrderParams(invalidSeaportOrder)

    const calldata = seaportInterface.encodeFunctionData('fulfillAdvancedOrder', [
      seaportOrder,
      [],
      OPENSEA_CONDUIT_KEY,
      alice.address,
    ])

    planner.addCommand(CommandType.SEAPORT, [seaportValue.toString(), calldata])
    const { commands, inputs } = planner

    await expect(
      router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: seaportValue })
    ).to.be.revertedWithCustomError(router, 'ExecutionFailed')
  })
})
