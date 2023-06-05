import FOUNDATION_ABI from './shared/abis/Foundation.json'
import { UniversalRouter, Permit2 } from '../../typechain'
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter'
import { ALICE_PRIVATE_KEY, BOB_PRIVATE_KEY, ALICE_ADDRESS, DEADLINE} from './shared/constants'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import hre from 'hardhat'
import NFT20_ABI from './shared/abis/NFT20.json'
import { BigNumber } from 'ethers'
import { Wallet, Provider, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { expect } from 'chai'

import "@matterlabs/hardhat-zksync-chai-matchers";
import { CommandType, RoutePlanner } from './shared/planner'
const { ethers } = hre
import {
  createLooksRareOrders,
  looksRareInterface,
  looksRareOrders,
  LOOKS_RARE_1155_ORDER,
  LOOKS_RARE_721_ORDER,
  MakerOrder,
  TakerOrder,
} from './shared/protocolHelpers/looksRare'



describe('LooksRare', () => {
  let provider: Provider
  let alice: Wallet
  let bob: Wallet
  let router: Contract
  let value: BigNumber
  let permit2: Permit2
  let planner: RoutePlanner
  let deployer: Deployer
  let cryptoCovens: Contract
  let twerkyContract: Contract
  let mockLooksRare: Contract

  beforeEach(async () => {
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    bob = new Wallet(BOB_PRIVATE_KEY, provider)
    deployer = new Deployer(hre, alice)
    planner = new RoutePlanner()

          
    const MockERC721 = await deployer.loadArtifact('MockERC721');
    const MockERC1155 = await deployer.loadArtifact("MockERC1155");
    const MockLooksRare = await deployer.loadArtifact("MockLooksRare");


    cryptoCovens = await deployer.deploy(MockERC721, [alice.address])
    cryptoCovens = new Contract(cryptoCovens.address, MockERC721.abi, alice)

    twerkyContract = await deployer.deploy(MockERC1155, [])
    twerkyContract = new Contract(twerkyContract.address, MockERC1155.abi, alice)

    mockLooksRare = await deployer.deploy(MockLooksRare, [])
    mockLooksRare = new Contract(mockLooksRare.address, MockLooksRare.abi, alice)

    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployUniversalRouter(permit2, '', '', '', '', '', '', '', '', mockLooksRare.address)).connect(alice) as UniversalRouter
    planner = new RoutePlanner()
  })

  describe('ERC-721 Purchase', () => {
    let takerOrder: TakerOrder
    let makerOrder: MakerOrder
    let tokenId: BigNumber

    beforeEach(async () => {
      ;({ makerOrder, takerOrder, value } = createLooksRareOrders(
        looksRareOrders[LOOKS_RARE_721_ORDER],
        router.address
      ))
      tokenId = makerOrder.tokenId
      await(await cryptoCovens.mint(router.address, tokenId)).wait()

    })

    it('Buys a Coven', async () => {
      const calldata = looksRareInterface.encodeFunctionData('matchAskWithTakerBidUsingETHAndWETH', [
        takerOrder,
        makerOrder,
      ])

      planner.addCommand(CommandType.LOOKS_RARE_721, [value, calldata, ALICE_ADDRESS, cryptoCovens.address, tokenId])
      const { commands, inputs } = planner

      await(await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value })).wait()

      await expect(await cryptoCovens.connect(alice).ownerOf(tokenId)).to.eq(ALICE_ADDRESS)
    })
  })

  describe('ERC-1155 Purchase', () => {
    let takerOrder: TakerOrder
    let makerOrder: MakerOrder
    let tokenId: BigNumber
    let value: BigNumber
    let commands: string
    let inputs: string[]

    beforeEach(async () => {
      ;({ makerOrder, takerOrder, value } = createLooksRareOrders(
        looksRareOrders[LOOKS_RARE_1155_ORDER],
        router.address
      ))
      tokenId = makerOrder.tokenId
      const calldata = looksRareInterface.encodeFunctionData('matchAskWithTakerBidUsingETHAndWETH', [
        takerOrder,
        makerOrder,
      ])
      planner.addCommand(CommandType.LOOKS_RARE_1155, [value, calldata, ALICE_ADDRESS, twerkyContract.address, tokenId, 1])
      ;({ commands, inputs } = planner)
      await(await twerkyContract.mint(router.address, tokenId, 1)).wait()

    })

    it('Buys a Twerky', async () => {
      await expect(await twerkyContract.balanceOf(alice.address, tokenId)).to.eq(0)
      await(await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value })).wait()
      await expect(await twerkyContract.balanceOf(alice.address, tokenId)).to.eq(1)
    })
  })
})
