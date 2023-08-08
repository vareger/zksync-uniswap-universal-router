import hre from 'hardhat'
import { Wallet, Provider, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

import { ALICE_PRIVATE_KEY } from './constants'

import { ZkSyncArtifact } from '@matterlabs/hardhat-zksync-deploy/dist/types'
import UniswapV3FactoryArtifact from './abis/UniswapV3Factory.json'
import SwapRouterArtifact from './abis/SwapRouter.json'
import NonfungibleTokenPositionDescriptorArtifact from './abis/NonfungibleTokenPositionDescriptor.json'
import NonfungiblePositionManagerArtifact from './abis/NonfungiblePositionManager.json'

export type UniswapV3Factory = Contract
export type NonfungiblePositionManager = Contract
export type NonfungibleTokenPositionDescriptor = Contract
export type SwapRouter = Contract

export async function deployUniswapV3(
  wethAddress: string
): Promise<[UniswapV3Factory, NonfungiblePositionManager, SwapRouter]> {
  // Initialize the wallet.
  const provider = Provider.getDefaultProvider()
  const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)
  const deployer = new Deployer(hre, wallet)

  const UniswapV3Factory = UniswapV3FactoryArtifact as any as ZkSyncArtifact
  const SwapRouter = SwapRouterArtifact as any as ZkSyncArtifact
  const NonfungibleTokenPositionDescriptor = NonfungibleTokenPositionDescriptorArtifact as any as ZkSyncArtifact
  const NonfungiblePositionManager = NonfungiblePositionManagerArtifact as any as ZkSyncArtifact

  const uniswapV3Factory = (await deployer.deploy(UniswapV3Factory, [])) as unknown as UniswapV3Factory
  const nonfungibleTokenPositionDescriptor = (await deployer.deploy(NonfungibleTokenPositionDescriptor, [
    wethAddress,
  ])) as unknown as NonfungibleTokenPositionDescriptor
  const nonfungiblePositionManager = (await deployer.deploy(NonfungiblePositionManager, [
    uniswapV3Factory.address,
    wethAddress,
    nonfungibleTokenPositionDescriptor.address,
  ])) as unknown as NonfungiblePositionManager

  const swapRouter = (await deployer.deploy(SwapRouter, [
    uniswapV3Factory.address,
    wethAddress,
  ])) as unknown as SwapRouter

  return [uniswapV3Factory, nonfungiblePositionManager, swapRouter]
}
