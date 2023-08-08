import { UniversalRouter, Permit2 } from '../../typechain'
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter'
import { ALICE_PRIVATE_KEY, ALICE_ADDRESS, DEADLINE, ZERO_ADDRESS } from './shared/constants'
import hre from 'hardhat'
import NFT20_ABI from './shared/abis/NFT20.json'
import { BigNumber } from 'ethers'
import { Wallet, Provider, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { expect } from 'chai'
import '@matterlabs/hardhat-zksync-chai-matchers'
import { CommandType, RoutePlanner } from './shared/planner'
const { ethers } = hre
const NFT20_INTERFACE = new ethers.utils.Interface(NFT20_ABI)

describe('NFT20', () => {
  let provider: Provider
  let alice: Wallet
  let router: Contract
  let permit2: Permit2
  let planner: RoutePlanner
  let deployer: Deployer
  let mockAlphabetties: Contract

  beforeEach(async () => {
    planner = new RoutePlanner()
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    deployer = new Deployer(hre, alice)
    const MockAlphabetties = await deployer.loadArtifact('MockAlphabetties')

    mockAlphabetties = await deployer.deploy(MockAlphabetties, [ALICE_ADDRESS])
    mockAlphabetties = new Contract(mockAlphabetties.address, MockAlphabetties.abi, alice)

    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (
      await deployUniversalRouter(
        permit2,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        mockAlphabetties.address
      )
    ).connect(alice) as UniversalRouter
  })

  // In this test we will buy token ids 129, 193, 278 of Alphabetties (0x6d05064fe99e40f1c3464e7310a23ffaded56e20).
  // We will send 0.021~ ETH (20583701229648230 wei), and we will get refunded 1086067487962785 wei
  describe('Buy 3 alphabetties from NFT20', () => {
    it('purchases token ids 129, 193, 278 of Alphabetties', async () => {
      const value = BigNumber.from('20583701229648230')
      const calldata = NFT20_INTERFACE.encodeFunctionData('ethForNft', [
        mockAlphabetties.address,
        ['129', '193', '278'],
        ['1', '1', '1'],
        ALICE_ADDRESS,
        0,
        false,
      ])
      planner.addCommand(CommandType.NFT20, [value, calldata])
      const { commands, inputs } = planner

      await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value })).wait()

      // Expect that alice has the NFTs
      await expect(await mockAlphabetties.ownerOf(129)).to.eq(ALICE_ADDRESS)
      await expect(await mockAlphabetties.ownerOf(193)).to.eq(ALICE_ADDRESS)
      await expect(await mockAlphabetties.ownerOf(278)).to.eq(ALICE_ADDRESS)
    })
  })
})
