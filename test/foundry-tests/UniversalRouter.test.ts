import { Callbacks, ERC1155, MintableERC20, Permit2, UniversalRouter } from '../../typechain'
import '@matterlabs/hardhat-zksync-chai-matchers'
import { deployPermit2, deployRouter } from '../integration-tests/shared/deployUniversalRouter'
import { Wallet } from 'zksync-web3'
import { expandTo18DecimalsBN } from '../integration-tests/shared/helpers'
import { RoutePlanner, CommandType } from '../integration-tests/shared/planner'
import { expect } from 'chai'
import { getWallets, provider } from '../integration-tests/shared/zkSyncUtils'
import { deployContract } from '../integration-tests/shared/zkSyncUtils'
import { BigNumber, ethers } from 'ethers'
describe('UniversalRouter Test:', () => {
  let alice: Wallet
  let permit2: Permit2
  let router: UniversalRouter
  let erc20: MintableERC20
  let erc1155: ERC1155
  let callback: Callbacks
  let planner: RoutePlanner
  let AMOUNT: BigNumber = expandTo18DecimalsBN(1)
  let RECIPIENT: string

  beforeEach(async () => {
    alice = getWallets()[0]
    RECIPIENT = ethers.utils.computeAddress(ethers.utils.hashMessage('10'))
    erc20 = <MintableERC20>await deployContract('MintableERC20', [18, BigNumber.from(10).pow(30)])
    erc1155 = <ERC1155>await deployContract('MockERC1155')
    callback = <Callbacks>await deployContract('Callbacks')
    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployRouter(permit2)).connect(alice) as UniversalRouter
    planner = new RoutePlanner()
  })

  it('testSweepToken', async () => {
    planner.addCommand(CommandType.SWEEP, [erc20.address, RECIPIENT, AMOUNT])
    const { commands, inputs } = planner

    await (await erc20.connect(alice).mint(router.address, AMOUNT)).wait()

    expect(await erc20.balanceOf(RECIPIENT)).to.be.equal(0)

    await (await router['execute(bytes,bytes[])'](commands, inputs)).wait()

    expect(await erc20.balanceOf(RECIPIENT)).to.be.equal(AMOUNT)
  })

  it('testSweepTokenInsufficientOutput', async () => {
    planner.addCommand(CommandType.SWEEP, [erc20.address, RECIPIENT, expandTo18DecimalsBN(2)])
    const { commands, inputs } = planner

    await (await erc20.connect(alice).mint(router.address, AMOUNT)).wait()

    expect(await erc20.balanceOf(RECIPIENT)).to.be.equal(0)

    await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(
      router,
      'InsufficientToken'
    )
  })

  it('testSweepETH', async () => {
    planner.addCommand(CommandType.SWEEP, ['0x0000000000000000000000000000000000000000', RECIPIENT, AMOUNT])

    const { commands, inputs } = planner

    expect(await provider.getBalance(RECIPIENT)).to.be.equal(0)

    await (await router['execute(bytes,bytes[])'](commands, inputs, { value: AMOUNT })).wait()

    expect(await provider.getBalance(RECIPIENT)).to.be.equal(AMOUNT)
  })

  it('testSweepETHInsufficientOutput', async () => {
    planner.addCommand(CommandType.SWEEP, ['0x0000000000000000000000000000000000000000', RECIPIENT, AMOUNT.add(1)])
    const { commands, inputs } = planner

    await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(
      router,
      'InsufficientETH'
    )
  })

  it('testSweepERC1155NotFullAmount', async () => {
    let id: BigNumber = ethers.constants.Zero
    planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, RECIPIENT, id, AMOUNT.div(2)])
    const { commands, inputs } = planner

    await (await erc1155.connect(alice).mint(router.address, id, AMOUNT)).wait()

    expect(await erc1155.balanceOf(RECIPIENT, id)).to.be.equal(ethers.constants.Zero)

    await (await router['execute(bytes,bytes[])'](commands, inputs)).wait()

    expect(await erc1155.balanceOf(RECIPIENT, id)).to.be.equal(AMOUNT)
  })

  it('testSweepERC1155', async () => {
    let id: BigNumber = ethers.constants.Zero
    planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, RECIPIENT, id, AMOUNT])
    const { commands, inputs } = planner

    await (await erc1155.connect(alice).mint(router.address, id, AMOUNT)).wait()
    expect(await erc1155.balanceOf(RECIPIENT, id)).to.be.equal(ethers.constants.Zero)

    await (await router['execute(bytes,bytes[])'](commands, inputs)).wait()

    expect(await erc1155.balanceOf(RECIPIENT, id)).to.be.equal(AMOUNT)
  })

  it('testSweepERC1155InsufficientOutput', async () => {
    let id: BigNumber = ethers.constants.Zero
    planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, RECIPIENT, id, AMOUNT.add(1)])
    const { commands, inputs } = planner

    await (await erc1155.connect(alice).mint(router.address, id, AMOUNT)).wait()

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
