import { CommandType, RoutePlanner } from './shared/planner'
import { expect } from 'chai'
import { MockERC1155, MockERC721, Permit2, UniversalRouter } from '../typechain'
import { DEADLINE } from './shared/constants'
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter'
import { Wallet } from 'zksync-web3'
import { deployContract, getWallets } from './shared/zkSyncUtils'

describe('Check Ownership', () => {
  let alice: Wallet
  let router: UniversalRouter
  let permit2: Permit2
  let planner: RoutePlanner
  let mockERC721: MockERC721
  let mockERC1155: MockERC1155
  let owner: Wallet

  beforeEach(async () => {
    alice = getWallets()[0]
    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployUniversalRouter(permit2)).connect(alice) as UniversalRouter
    planner = new RoutePlanner()
    mockERC721 = (await deployContract('MockERC721')) as MockERC721
    mockERC1155 = (await deployContract('MockERC1155')) as MockERC1155
    owner = getWallets()[1]
    await mockERC721.mint(owner.address, 0)
    await mockERC1155.mint(owner.address, 0, 1)
  })

  describe('checksOwnership ERC721', () => {
    it('passes with valid owner', async () => {
      planner.addCommand(CommandType.OWNER_CHECK_721, [owner.address, mockERC721.address, 0])

      const { commands, inputs } = planner
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.not.be.reverted
    })

    it('reverts for invalid ownership', async () => {
      planner.addCommand(CommandType.OWNER_CHECK_721, [alice.address, mockERC721.address, 0])

      const { commands, inputs } = planner
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE))
        .to.be.revertedWithCustomError(router, 'ExecutionFailed')
        .withArgs(0, '0x7dbe7e89')
    })
  })

  describe('checksOwnership ERC1155', () => {
    it('passes with valid ownership', async () => {
      planner.addCommand(CommandType.OWNER_CHECK_1155, [owner.address, mockERC1155.address, 0, 1])

      const { commands, inputs } = planner
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.not.be.reverted
    })

    it('reverts for invalid ownership', async () => {
      planner.addCommand(CommandType.OWNER_CHECK_1155, [alice.address, mockERC1155.address, 0, 1])

      const { commands, inputs } = planner
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE))
        .to.be.revertedWithCustomError(router, 'ExecutionFailed')
        .withArgs(0, '0x483a6929')
    })
  })
})
