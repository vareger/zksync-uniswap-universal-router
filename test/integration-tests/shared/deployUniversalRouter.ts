import hre from 'hardhat'
// const { ethers } = hre
import { Permit2, UniversalRouter } from '../../../typechain'
import { Wallet, Provider } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

import { ALICE_PRIVATE_KEY, ZERO_ADDRESS, V2_INIT_CODE_HASH_MAINNET, V3_INIT_CODE_HASH_MAINNET } from './constants'

export async function deployRouter(
  permit2: Permit2,
  weth9Address?: string,
  seaportAddress?: string,
  nftxZapAddress?: string,
  x2y2Address?: string,
  foundationAddress?: string,
  sudoswapAddress?: string,
  nft20ZapAddress?: string,
  cryptopunksAddress?: string,
  looksRareAddress?: string,
  routerRewardsDistributorAddress?: string,
  looksRareRewardsDistributorAddress?: string,
  looksRareTokenAddress?: string,
  v2FactoryAddress?: string,
  v3FactoryAddress?: string,
  mockLooksRareRewardsDistributor?: string,
  mockLooksRareToken?: string
): Promise<UniversalRouter> {
  mockLooksRareRewardsDistributor
  mockLooksRareToken
  const routerParameters = {
    permit2: permit2.address || ZERO_ADDRESS,
    weth9: weth9Address || ZERO_ADDRESS,
    seaport: seaportAddress || ZERO_ADDRESS,
    nftxZap: nftxZapAddress || ZERO_ADDRESS,
    x2y2: x2y2Address || ZERO_ADDRESS,
    foundation: foundationAddress || ZERO_ADDRESS,
    sudoswap: sudoswapAddress || ZERO_ADDRESS,
    nft20Zap: nft20ZapAddress || ZERO_ADDRESS,
    cryptopunks: cryptopunksAddress || ZERO_ADDRESS,
    looksRare: looksRareAddress || ZERO_ADDRESS,
    routerRewardsDistributor: routerRewardsDistributorAddress || ZERO_ADDRESS,
    looksRareRewardsDistributor: looksRareRewardsDistributorAddress || ZERO_ADDRESS,
    looksRareToken: looksRareTokenAddress || ZERO_ADDRESS,
    v2Factory: v2FactoryAddress || ZERO_ADDRESS,
    v3Factory: v3FactoryAddress || ZERO_ADDRESS,
    pairInitCodeHash: V2_INIT_CODE_HASH_MAINNET,
    poolInitCodeHash: V3_INIT_CODE_HASH_MAINNET,
  }

  // Initialize the wallet.
  const provider = Provider.getDefaultProvider()
  const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet)
  const artifact = await deployer.loadArtifact('UniversalRouter')

  const router = (await deployer.deploy(artifact, [routerParameters])) as unknown as UniversalRouter
  return router
}

export default deployRouter

export async function deployMockPermit2(): Promise<Permit2> {
  console.log(`Running deploy script for the Permit2 contract`)

  // Initialize the wallet.
  const provider = Provider.getDefaultProvider()
  const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet)
  const artifact = await deployer.loadArtifact('MockPermit2')

  const permit2 = (await deployer.deploy(artifact, [])) as unknown as Permit2

  return permit2
}

export async function deployPermit2(): Promise<Permit2> {
  // Initialize the wallet.
  const provider = Provider.getDefaultProvider()
  const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet)
  const artifact = await deployer.loadArtifact('Permit2')

  const permit2 = (await deployer.deploy(artifact, [])) as unknown as Permit2

  return permit2
}

export async function deployRouterAndPermit2(
  mockLooksRareRewardsDistributor?: string,
  mockLooksRareToken?: string
): Promise<[UniversalRouter, Permit2]> {
  const permit2 = await deployPermit2()
  const router = await deployRouter(
    permit2,
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    mockLooksRareRewardsDistributor,
    mockLooksRareToken
  )
  return [router, permit2]
}
