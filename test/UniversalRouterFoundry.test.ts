import {
  Callbacks,
  MockERC1155,
  MockERC20,
  UniversalRouter
} from '../typechain'
import '@matterlabs/hardhat-zksync-chai-matchers'
import { expandTo18DecimalsBN } from './shared/helpers'
import { RoutePlanner, CommandType } from './shared/planner'
import { expect } from 'chai'
import { provider } from './shared/zkSyncUtils'
import { deployContract } from './shared/zkSyncUtils'
import { BigNumber, ethers } from 'ethers'
import { ETH_ADDRESS } from "./shared/constants";

describe('UniversalRouter Test(rewritten from foundry):', () => {
  const AMOUNT: BigNumber = expandTo18DecimalsBN(1)
  // First 2^16 addresses are system
  const RECIPIENT: string = '0x0000000000000000000000000000000000010010'

  let router: UniversalRouter
  let erc20: MockERC20
  let erc1155: MockERC1155
  let callback: Callbacks

  let planner: RoutePlanner

  beforeEach(async () => {
    let params = {
      permit2: '0x0000000000000000000000000000000000000000',
      weth9: '0x0000000000000000000000000000000000000000',
      seaport: '0x0000000000000000000000000000000000000000',
      nftxZap: '0x0000000000000000000000000000000000000000',
      x2y2: '0x0000000000000000000000000000000000000000',
      foundation: '0x0000000000000000000000000000000000000000',
      sudoswap: '0x0000000000000000000000000000000000000000',
      nft20Zap: '0x0000000000000000000000000000000000000000',
      cryptopunks: '0x0000000000000000000000000000000000000000',
      looksRare: '0x0000000000000000000000000000000000000000',
      routerRewardsDistributor: '0x0000000000000000000000000000000000000000',
      looksRareRewardsDistributor: '0x0000000000000000000000000000000000000000',
      looksRareToken: '0x0000000000000000000000000000000000000000',
      v2Factory: '0x0000000000000000000000000000000000000000',
      v3Factory: '0x0000000000000000000000000000000000000000',
      pairInitCodeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      poolInitCodeHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
    }
    router = (await deployContract('UniversalRouter', [params])) as UniversalRouter
    await deployContract('ExampleModule')
    erc20 = (await deployContract('MockERC20')) as MockERC20
    erc1155 = (await deployContract('MockERC1155')) as MockERC1155
    callback = (await deployContract('Callbacks')) as Callbacks
    planner = new RoutePlanner()
  })

  it('testSweepToken', async () => {
    planner.addCommand(CommandType.SWEEP, [erc20.address, RECIPIENT, AMOUNT])
    const { commands, inputs } = planner

    await erc20.mint(router.address, AMOUNT)
    expect(await erc20.balanceOf(RECIPIENT)).to.be.equal(0)

    await router['execute(bytes,bytes[])'](commands, inputs)

    expect(await erc20.balanceOf(RECIPIENT)).to.be.equal(AMOUNT)
  })

  it('testSweepTokenInsufficientOutput', async () => {
    planner.addCommand(CommandType.SWEEP, [erc20.address, RECIPIENT, AMOUNT.add(1)])
    const { commands, inputs } = planner

    await erc20.mint(router.address, AMOUNT)
    expect(await erc20.balanceOf(RECIPIENT)).to.be.equal(0)

    await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(
      router,
      'InsufficientToken'
    )
  })

  it('testSweepETH', async () => {
    planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, RECIPIENT, AMOUNT])
    const { commands, inputs } = planner

    expect(await provider.getBalance(RECIPIENT)).to.be.equal(0)

    await router['execute(bytes,bytes[])'](commands, inputs, { value: AMOUNT })

    expect(await provider.getBalance(RECIPIENT)).to.be.equal(AMOUNT)
  })

  it('testSweepETHInsufficientOutput', async () => {
    planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, RECIPIENT, AMOUNT.add(1)])
    const { commands, inputs } = planner

    await erc20.mint(router.address, AMOUNT)

    await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(
      router,
      'InsufficientETH'
    )
  })

  it('testSweepERC1155NotFullAmount', async () => {
    const id = 0
    planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, RECIPIENT, id, AMOUNT.div(2)])
    const { commands, inputs } = planner

    await erc1155.mint(router.address, id, AMOUNT)
    expect(await erc1155.balanceOf(RECIPIENT, id)).to.be.equal(0)

    await router['execute(bytes,bytes[])'](commands, inputs)

    expect(await erc1155.balanceOf(RECIPIENT, id)).to.be.equal(AMOUNT)
  })

  it('testSweepERC1155', async () => {
    let id = 0
    planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, RECIPIENT, id, AMOUNT])
    const { commands, inputs } = planner

    await erc1155.mint(router.address, id, AMOUNT)
    expect(await erc1155.balanceOf(RECIPIENT, id)).to.be.equal(0)

    await router['execute(bytes,bytes[])'](commands, inputs)

    expect(await erc1155.balanceOf(RECIPIENT, id)).to.be.equal(AMOUNT)
  })

  it('testSweepERC1155InsufficientOutput', async () => {
    let id = 0
    planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, RECIPIENT, id, AMOUNT.add(1)])
    const { commands, inputs } = planner

    await erc1155.mint(router.address, id, AMOUNT)

    await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(
      router,
      'InsufficientToken'
    )
  })

  it('testSupportsInterface', async () => {
    expect(await callback.supportsInterface(ethers.utils.arrayify('0x4e2312e0'))).to.be.true
    expect(await callback.supportsInterface(ethers.utils.arrayify('0x150b7a02'))).to.be.true
    expect(await callback.supportsInterface(ethers.utils.arrayify('0x01ffc9a7'))).to.be.true
  })
})
