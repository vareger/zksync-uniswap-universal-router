import { CommandType, RoutePlanner } from './shared/planner'
import { expect } from './shared/expect'
import { ERC721, Permit2, UniversalRouter } from '../../typechain'
import {
  seaportOrders,
  seaportInterface,
  getAdvancedOrderParams,
  purchaseDataForTwoCovensSeaport,
} from './shared/protocolHelpers/seaport'
import { Wallet, Provider, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { createLooksRareOrders, looksRareOrders, LOOKS_RARE_1155_ORDER } from './shared/protocolHelpers/looksRare'
import { ALICE_PRIVATE_KEY, DEADLINE, OPENSEA_CONDUIT_KEY, ZERO_ADDRESS } from './shared/constants'
import hre from 'hardhat'
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter'

describe('Check Ownership', () => {
  let provider: Provider
  let alice: Wallet
  let router: UniversalRouter
  let permit2: Permit2
  let planner: RoutePlanner
  let cryptoCovens: ERC721
  let seaport: Contract
  let looksRare1155: Contract

  before(async () => {
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    let deployer = new Deployer(hre, alice)

    const MockCryptoCovens = await deployer.loadArtifact('MockCryptoCovens')
    const MockSeaport2 = await deployer.loadArtifact('MockSeaport2')
    const MockLooksRare1155 = await deployer.loadArtifact('MockLooksRare1155')

    cryptoCovens = (await deployer.deploy(MockCryptoCovens, [alice.address])) as unknown as ERC721
    seaport = await deployer.deploy(MockSeaport2, [cryptoCovens.address, alice.address])
    looksRare1155 = await deployer.deploy(MockLooksRare1155, [alice.address])

    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployUniversalRouter(permit2, ZERO_ADDRESS, seaport.address)).connect(alice) as UniversalRouter

    planner = new RoutePlanner()
  })

  describe('checksOwnership ERC721', () => {
    beforeEach(async () => {
      planner = new RoutePlanner()
    })

    it('passes with valid owner', async () => {
      const { advancedOrder } = getAdvancedOrderParams(seaportOrders[0])
      const params = advancedOrder.parameters

      planner.addCommand(CommandType.OWNER_CHECK_721, [
        ZERO_ADDRESS,
        cryptoCovens.address,
        params.offer[0].identifierOrCriteria,
      ])

      const { commands, inputs } = planner
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.not.be.reverted
    })

    it('reverts for invalid ownership', async () => {
      const { advancedOrder } = getAdvancedOrderParams(seaportOrders[0])
      const params = advancedOrder.parameters
      planner.addCommand(CommandType.OWNER_CHECK_721, [
        params.offerer,
        cryptoCovens.address,
        params.offer[0].identifierOrCriteria,
      ])

      const { commands, inputs } = planner
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.be.reverted
    })

    it('checks ownership after a seaport trade for one ERC721', async () => {
      const { advancedOrder, value } = getAdvancedOrderParams(seaportOrders[0])
      const params = advancedOrder.parameters
      const calldata = seaportInterface.encodeFunctionData('fulfillAdvancedOrder', [
        advancedOrder,
        [],
        OPENSEA_CONDUIT_KEY,
        alice.address,
      ])

      await (await cryptoCovens.mint(alice.address, params.offer[0].identifierOrCriteria)).wait()
      planner.addCommand(CommandType.SEAPORT, [value.toString(), calldata])
      planner.addCommand(CommandType.OWNER_CHECK_721, [
        alice.address,
        cryptoCovens.address,
        params.offer[0].identifierOrCriteria,
      ])

      const { commands, inputs } = planner

      await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()
      const ownerAfter = await cryptoCovens.ownerOf(params.offer[0].identifierOrCriteria)

      expect(ownerAfter).to.eq(alice.address)
    })

    it('checks ownership after a seaport trade for two ERC721s', async () => {
      const { calldata, advancedOrder0, advancedOrder1, value } = purchaseDataForTwoCovensSeaport(alice.address)
      const params0 = advancedOrder0.parameters
      const params1 = advancedOrder1.parameters

      await (await cryptoCovens.mint(alice.address, params1.offer[0].identifierOrCriteria)).wait()
      planner.addCommand(CommandType.SEAPORT, [value.toString(), calldata])
      planner.addCommand(CommandType.OWNER_CHECK_721, [
        alice.address,
        cryptoCovens.address,
        params0.offer[0].identifierOrCriteria,
      ])
      planner.addCommand(CommandType.OWNER_CHECK_721, [
        alice.address,
        cryptoCovens.address,
        params1.offer[0].identifierOrCriteria,
      ])

      const { commands, inputs } = planner

      await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()

      const owner0After = await cryptoCovens.ownerOf(params0.offer[0].identifierOrCriteria)
      const owner1After = await cryptoCovens.ownerOf(params1.offer[0].identifierOrCriteria)

      expect(owner0After).to.eq(alice.address)
      expect(owner1After).to.eq(alice.address)
    })
  })

  describe('checksOwnership ERC1155', () => {
    beforeEach(async () => {
      planner = new RoutePlanner()
    })

    it('passes with valid ownership', async () => {
      const { makerOrder } = createLooksRareOrders(looksRareOrders[LOOKS_RARE_1155_ORDER], router.address)

      await (await looksRare1155.mint(makerOrder.signer, makerOrder.tokenId, 1)).wait()

      planner.addCommand(CommandType.OWNER_CHECK_1155, [
        makerOrder.signer,
        looksRare1155.address,
        makerOrder.tokenId,
        1,
      ])

      const { commands, inputs } = planner
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.not.be.reverted
    })

    it('reverts for invalid ownership', async () => {
      const { makerOrder } = createLooksRareOrders(looksRareOrders[LOOKS_RARE_1155_ORDER], router.address)

      planner.addCommand(CommandType.OWNER_CHECK_1155, [alice.address, makerOrder.collection, makerOrder.tokenId, 1])

      const { commands, inputs } = planner
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.be.reverted
    })
  })
})
