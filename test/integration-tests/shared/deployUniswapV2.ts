import hre from 'hardhat'
// const { ethers } = hre

import { Wallet, Provider, utils, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

import { ALICE_PRIVATE_KEY, ALICE_ADDRESS } from './constants'

import { ZkSyncArtifact } from '@matterlabs/hardhat-zksync-deploy/dist/types'
import UniswapV2FactoryArtifact from './abis/UniswapV2Factory.json'
import UniswapV2Router02Artifact from './abis/UniswapV2Router02.json'
import UniswapV2PairArtifact from './abis/UniswapV2Pair.json'
import {HttpNetworkConfig} from "hardhat/src/types/config";

export type UniswapV2Factory = Contract
export type UniswapV2Router02 = Contract

export async function deployUniswapV2(wethAddress: string): Promise<[UniswapV2Factory, UniswapV2Router02]> {
  // Initialize the wallet.
  const provider = new Provider((hre.network.config as HttpNetworkConfig).url);
  const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)
  const deployer = new Deployer(hre, wallet)

  const UniswapV2Factory_ZkSyncArtifact = UniswapV2FactoryArtifact as any as ZkSyncArtifact
  const UniswapV2Router02_ZkSyncArtifact = UniswapV2Router02Artifact as any as ZkSyncArtifact

  const uniswapV2Factory = (await deployer.deploy(UniswapV2Factory_ZkSyncArtifact, [
    ALICE_ADDRESS,
  ])) as unknown as UniswapV2Factory
  const uniswapRouterV2 = (await deployer.deploy(UniswapV2Router02_ZkSyncArtifact, [
    uniswapV2Factory.address,
    wethAddress,
  ])) as unknown as UniswapV2Router02

  return [uniswapV2Factory, uniswapRouterV2]
}

export async function calculateInitCodeHash(): Promise<string> {
  const UniswapV2Pair = UniswapV2PairArtifact as any as ZkSyncArtifact
  let initCodeHash = utils.hashBytecode(UniswapV2Pair.bytecode)
  let initCodeHashHex = '0x' + Buffer.from(initCodeHash).toString('hex')
  return initCodeHashHex
}
