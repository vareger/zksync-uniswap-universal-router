import hre from 'hardhat'
// const { ethers } = hre
import { UniswapV3Factory, NonfungiblePositionManager, NonfungibleTokenPositionDescriptor, SwapRouter } from '../../../typechain'
import { Wallet, Provider } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

import {
    ALICE_PRIVATE_KEY,
} from './constants'

export async function deployUniswapV3(
    wethAddress: string
): Promise<[UniswapV3Factory, NonfungiblePositionManager, SwapRouter]> {

    // Initialize the wallet.
    const provider = Provider.getDefaultProvider()
    const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)
    const deployer = new Deployer(hre, wallet)
    
    const UniswapV3Factory = await deployer.loadArtifact("UniswapV3Factory");
    const SwapRouter = await deployer.loadArtifact("SwapRouter");
    const NonfungibleTokenPositionDescriptor = await deployer.loadArtifact("NonfungibleTokenPositionDescriptor")
    const NonfungiblePositionManager = await deployer.loadArtifact("NonfungiblePositionManager");

    const uniswapV3Factory = await deployer.deploy(UniswapV3Factory, []) as unknown as UniswapV3Factory;
    const nonfungibleTokenPositionDescriptor = await deployer.deploy(NonfungibleTokenPositionDescriptor, [wethAddress]) as unknown as NonfungibleTokenPositionDescriptor;
    const nonfungiblePositionManager = await deployer.deploy(NonfungiblePositionManager, 
        [
          uniswapV3Factory.address, 
          wethAddress, 
          nonfungibleTokenPositionDescriptor.address
        ]) as unknown as NonfungiblePositionManager;
    
    const swapRouter = await deployer.deploy(SwapRouter, [uniswapV3Factory.address, wethAddress]) as unknown as SwapRouter;

    return [uniswapV3Factory, nonfungiblePositionManager, swapRouter]
}

