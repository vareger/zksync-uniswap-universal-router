import { UniversalRouter, Permit2, IWETH9 } from '../../typechain'
import { V2_INIT_CODE_HASH, V3_INIT_CODE_HASH } from './constants'
import { deployContract, deployContractWithArtifact, getWallets } from './zkSyncUtils'
import WETH9 from '../contracts/WETH9.json'
import { ZkSyncArtifact } from '@matterlabs/hardhat-zksync-deploy/dist/types'
import * as FACTORY_V2_ARTIFACT from '@uniswap/v2-core/artifacts-zk/contracts/UniswapV2Factory.sol/UniswapV2Factory.json'
import * as PAIR_V2_ARTIFACT from '@uniswap/v2-core/artifacts-zk/contracts/UniswapV2Pair.sol/UniswapV2Pair.json'
import * as FACTORY_ARTIFACT from '@uniswap/v3-core/artifacts-zk/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import * as POOL_ARTIFACT from '@uniswap/v3-core/artifacts-zk/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import * as NFT_MANAGER_ARTIFACT from '@uniswap/v3-periphery/artifacts-zk/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { ContractFactory } from 'zksync-web3'
import { Contract } from '@ethersproject/contracts'
import { ethers } from 'ethers'

export async function deployRouter(
  permit2: Permit2,
  mockLooksRareRewardsDistributor?: string,
  mockLooksRareToken?: string,
  mockReentrantProtocol?: string,
  weth9?: string,
  v2Factory?: string,
  v3Factory?: string
): Promise<UniversalRouter> {
  const unsupportedProtocol = await deployContract('UnsupportedProtocol', [])
  const routerParameters = {
    permit2: permit2.address,
    weth9: weth9 ?? unsupportedProtocol.address,
    seaport: unsupportedProtocol.address,
    nftxZap: mockReentrantProtocol ?? unsupportedProtocol.address,
    x2y2: unsupportedProtocol.address,
    foundation: unsupportedProtocol.address,
    sudoswap: unsupportedProtocol.address,
    nft20Zap: unsupportedProtocol.address,
    cryptopunks: unsupportedProtocol.address,
    looksRare: unsupportedProtocol.address,
    routerRewardsDistributor: unsupportedProtocol.address,
    looksRareRewardsDistributor: mockLooksRareRewardsDistributor ?? unsupportedProtocol.address,
    looksRareToken: mockLooksRareToken ?? unsupportedProtocol.address,
    v2Factory: v2Factory ?? unsupportedProtocol.address,
    v3Factory: v3Factory ?? unsupportedProtocol.address,
    pairInitCodeHash: V2_INIT_CODE_HASH,
    poolInitCodeHash: V3_INIT_CODE_HASH,
  }

  return (await deployContract('UniversalRouter', [routerParameters])) as unknown as UniversalRouter
}

export default deployRouter

export async function deployPermit2(): Promise<Permit2> {
  return (await deployContract('Permit2')) as unknown as Permit2
}

export async function deployWeth(): Promise<IWETH9> {
  return (await deployContractWithArtifact(WETH9 as ZkSyncArtifact)) as IWETH9
}

export async function deployV2Factory(): Promise<Contract> {
  const contractFactory = new ContractFactory(FACTORY_V2_ARTIFACT.abi, FACTORY_V2_ARTIFACT.bytecode, getWallets()[0])

  const factoryDeps = [PAIR_V2_ARTIFACT.bytecode]
  return await contractFactory.deploy(ethers.constants.AddressZero, {
    customData: {
      factoryDeps,
    },
  })
}

export async function deployV3Factory(): Promise<Contract> {
  const contractFactory = new ContractFactory(FACTORY_ARTIFACT.abi, FACTORY_ARTIFACT.bytecode, getWallets()[0])

  let factoryDeps: string[] = [POOL_ARTIFACT.bytecode]
  return await contractFactory.deploy({
    customData: {
      factoryDeps,
    },
  })
}

export async function deployNftManager(v3Factory: string, weth9: string): Promise<Contract> {
  return await deployContractWithArtifact(NFT_MANAGER_ARTIFACT as ZkSyncArtifact, [
    v3Factory,
    weth9,
    // Isn't needed for the tests
    ethers.constants.AddressZero,
  ])
}

export async function deployRouterAndPermit2(
  mockLooksRareRewardsDistributor?: string,
  mockLooksRareToken?: string
): Promise<[UniversalRouter, Permit2]> {
  const permit2 = await deployPermit2()
  const router = await deployRouter(permit2, mockLooksRareRewardsDistributor, mockLooksRareToken)
  return [router, permit2]
}
