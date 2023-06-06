import { CommandType, RoutePlanner } from './shared/planner'
import { expect } from './shared/expect'
import { UniversalRouter, Permit2, ERC721, ERC1155, MockL2WETH } from '../../typechain'
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter'
import { parseEvents } from './shared/parseEvents'
import NFTX_ZAP_ABI from './shared/protocolHelpers/abis/NFTXZap.json'
import {
  ALICE_ADDRESS,
  ALICE_PRIVATE_KEY,
  DEADLINE,
  NFTX_COVEN_VAULT_ID,
  NFTX_ERC_1155_VAULT_ID,
  ZERO_ADDRESS,
} from './shared/constants'
import { Wallet, Provider, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { expandTo18DecimalsBN } from './shared/helpers'
import hre from 'hardhat'
const { ethers } = hre

const nftxZapInterface = new ethers.utils.Interface(NFTX_ZAP_ABI)

describe('NFTX', () => {
  let provider: Provider
  let alice: Wallet
  let router: UniversalRouter
  let permit2: Permit2
  let WETH: MockL2WETH
  let cryptoCovens: ERC721
  let twerkyContract: ERC1155
  let nftx_coven_vault: any
  let nftx_erc1155_vault: any
  let nftx_zap: any
  let planner: RoutePlanner

  before(async () => {
   
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    let deployer = new Deployer(hre, alice)

    const MockCryptoCovens = await deployer.loadArtifact("MockCryptoCovens")
    const MockL2WETH = await deployer.loadArtifact("MockL2WETH")
    const MockERC721 = await deployer.loadArtifact("MockERC721")
    const MockERC1155 = await deployer.loadArtifact("MockERC1155")
    const MockNFTX_Coven_Vault = await deployer.loadArtifact("MockNFTX_Coven_Vault")
    const MockNFTX_ERC_1155_Vault = await deployer.loadArtifact("MockNFTX_ERC_1155_Vault")
    const MockNFTX_ZAP = await deployer.loadArtifact("MockNFTX_ZAP")

    cryptoCovens = await deployer.deploy(MockCryptoCovens, [alice.address]) as unknown as ERC721
    WETH = await deployer.deploy(MockL2WETH, []) as unknown as MockL2WETH
    twerkyContract = await deployer.deploy(MockERC1155, [alice.address]) as unknown as ERC1155
    nftx_coven_vault = await deployer.deploy(MockNFTX_Coven_Vault, [cryptoCovens.address])
    nftx_erc1155_vault = await deployer.deploy(MockNFTX_ERC_1155_Vault, [twerkyContract.address])
    nftx_zap = await deployer.deploy(MockNFTX_ZAP, [nftx_coven_vault.address, nftx_erc1155_vault.address])

    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployUniversalRouter(
        permit2,
        WETH.address,
        ZERO_ADDRESS,
        nftx_zap.address
    )).connect(alice) as UniversalRouter

    planner = new RoutePlanner()
  })

  beforeEach(async() => {
    planner = new RoutePlanner()
  })

  it('completes an ERC-721 buyAndRedeem order with random selection', async () => {
    const value = expandTo18DecimalsBN(4)
    const numCovens = 2
    const calldata = nftxZapInterface.encodeFunctionData('buyAndRedeem', [
      NFTX_COVEN_VAULT_ID,
      numCovens,
      [],
      [WETH.address, nftx_coven_vault.address],
      alice.address,
    ])

    planner.addCommand(CommandType.NFTX, [value.toString(), calldata])
    const { commands, inputs } = planner

    const covenBalanceBefore = await cryptoCovens.balanceOf(alice.address)
    await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()
    const covenBalanceAfter = await cryptoCovens.balanceOf(alice.address)

    expect(covenBalanceAfter.sub(covenBalanceBefore)).to.eq(numCovens)
  })

  it('completes an ERC-721 buyAndRedeem order with specific selection', async () => {
    const value = expandTo18DecimalsBN(4)
    const numCovens = 2
    const calldata = nftxZapInterface.encodeFunctionData('buyAndRedeem', [
      NFTX_COVEN_VAULT_ID,
      numCovens,
      [584, 3033],
      [WETH.address, nftx_coven_vault.address],
      alice.address,
    ])

    planner.addCommand(CommandType.NFTX, [value.toString(), calldata])
    const { commands, inputs } = planner

    const covenBalanceBefore = await cryptoCovens.balanceOf(alice.address)
    const covenOwner584Before = await cryptoCovens.ownerOf(584)
    const covenOwner3033Before = await cryptoCovens.ownerOf(3033)
    await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()
    const covenBalanceAfter = await cryptoCovens.balanceOf(alice.address)
    const covenOwner584After = await cryptoCovens.ownerOf(584)
    const covenOwner3033After = await cryptoCovens.ownerOf(3033)

    expect(covenBalanceAfter.sub(covenBalanceBefore)).to.eq(numCovens)
    expect(covenOwner584Before).to.not.eq(alice.address)
    expect(covenOwner3033Before).to.not.eq(alice.address)
    expect(covenOwner584After).to.eq(alice.address)
    expect(covenOwner3033After).to.eq(alice.address)
  })

  it('completes an ERC-1155 buyAndRedeem order with random selection', async () => {
    const value = expandTo18DecimalsBN(4)
    const numTwerkys = 2
    const calldata = nftxZapInterface.encodeFunctionData('buyAndRedeem', [
      NFTX_ERC_1155_VAULT_ID,
      numTwerkys,
      [],
      [WETH.address, nftx_erc1155_vault.address],
      alice.address,
    ])

    planner.addCommand(CommandType.NFTX, [value, calldata])
    const { commands, inputs } = planner

    const tx = await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })
    const receipt = await tx.wait()
    // const tokenIds = parseEvents(twerkyContract.interface, receipt).map((event) => event!.args.id)
    expect(await twerkyContract.balanceOf(alice.address, 0)).to.eq(1)
    expect(await twerkyContract.balanceOf(alice.address, 1)).to.eq(1)
  })

  it('completes an ERC-1155 buyAndRedeem order with specific selection', async () => {
    planner = new RoutePlanner()
    const value = expandTo18DecimalsBN(4)
    const numTwerkys = 1
    const calldata = nftxZapInterface.encodeFunctionData('buyAndRedeem', [
      NFTX_ERC_1155_VAULT_ID,
      numTwerkys,
      [44],
      [WETH.address, nftx_erc1155_vault.address],
      alice.address,
    ])

    planner.addCommand(CommandType.NFTX, [value.toString(), calldata])
    const { commands, inputs } = planner

    const twerkyBalanceBefore = await twerkyContract.balanceOf(alice.address, 44)
    await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()
    const twerkyBalanceAfter = await twerkyContract.balanceOf(alice.address, 44)

    expect(twerkyBalanceAfter.sub(twerkyBalanceBefore)).to.eq(numTwerkys)
  })

  it('returns all extra ETH when sending too much', async () => {
    planner = new RoutePlanner()
    const value = expandTo18DecimalsBN(10)
    const numCovens = 2
    const saleCost = '476686977628668346'
    const calldata = nftxZapInterface.encodeFunctionData('buyAndRedeem', [
      NFTX_COVEN_VAULT_ID,
      numCovens,
      [584, 3033],
      [WETH.address, '0xd89b16331f39ab3878daf395052851d3ac8cf3cd'],
      alice.address,
    ])

    planner.addCommand(CommandType.NFTX, [value.toString(), calldata])
    const { commands, inputs } = planner

    const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait()

  })
})
