import hre from 'hardhat'
// const { ethers } = hre
import { UniswapV2Router02, UniswapV2Factory } from '../../../typechain'
import { Wallet, Provider, utils } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

import {
    ALICE_PRIVATE_KEY,
    ALICE_ADDRESS,
    ZERO_ADDRESS,
    V2_FACTORY_MAINNET,
    V3_FACTORY_MAINNET,
    V2_INIT_CODE_HASH_MAINNET,
    V3_INIT_CODE_HASH_MAINNET,
} from './constants'

export async function deployUniswapV2(
    wethAddress?: string
): Promise<[UniswapV2Factory, UniswapV2Router02]> {

    // Initialize the wallet.
    const provider = Provider.getDefaultProvider()
    const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)
    const deployer = new Deployer(hre, wallet)
    
    const UniswapV2Factory = await deployer.loadArtifact('lib/uniswapV2-zksync/contracts/UniswapV2Factory.sol:UniswapV2Factory')
    const UniswapV2Router02 = await deployer.loadArtifact('lib/uniswapV2-zksync/contracts/UniswapV2Router02.sol:UniswapV2Router02')
    const MockL2WETH = await deployer.loadArtifact('MockL2WETH')

    if (wethAddress === undefined) {
        let weth = await deployer.deploy(MockL2WETH, [])
        wethAddress = weth.address
    }

    const uniswapV2Factory = (await deployer.deploy(UniswapV2Factory, [ALICE_ADDRESS])) as UniswapV2Factory
    console.log("Uniswap factory address: " + uniswapV2Factory.address)
    const uniswapRouterV2 = (await deployer.deploy(UniswapV2Router02, [uniswapV2Factory.address, wethAddress])) as UniswapV2Router02
    console.log("Uniswap router address: " + uniswapRouterV2.address)

    return [uniswapV2Factory, uniswapRouterV2]
}

export async function deployUniswapV2Factory(
    feeToSetterAddress?: string
): Promise<UniswapV2Factory> {
    const provider = Provider.getDefaultProvider()
    const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)
    const deployer = new Deployer(hre, wallet)

    const UniswapV2Factory = await deployer.loadArtifact('UniswapV2Factory')
    const UniswapV2Router02 = await deployer.loadArtifact('UniswapV2Router02')
    const MockL2WETH = await deployer.loadArtifact('MockL2WETH')

    if (feeToSetterAddress === undefined) {
        feeToSetterAddress = ALICE_ADDRESS
    }
    const uniswapV2Factory = (await deployer.deploy(UniswapV2Factory, [feeToSetterAddress])) as UniswapV2Factory
    console.log("Uniswap factory address: " + uniswapV2Factory.address)

    return uniswapV2Factory
}

export async function deployUniswapV2Router(
    uniswapV2FactoryAddress?: string,
    wethAddress?: string
): Promise<UniswapV2Router02> {
    const provider = Provider.getDefaultProvider()
    const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)
    const deployer = new Deployer(hre, wallet)

    const UniswapV2Router02 = await deployer.loadArtifact('UniswapV2Router02')
    const MockL2WETH = await deployer.loadArtifact('MockL2WETH')

    if(uniswapV2FactoryAddress === undefined) {
        let uniswapV2Factory = await deployUniswapV2Factory()
        uniswapV2Factory.address
    }

    if (wethAddress === undefined) {
        let weth = await deployer.deploy(MockL2WETH, [])
        wethAddress = weth.address
    }

    const uniswapRouterV2 = (await deployer.deploy(UniswapV2Router02, [uniswapV2FactoryAddress, wethAddress])) as UniswapV2Router02
    console.log("Uniswap router address: " + uniswapRouterV2.address)
    return uniswapRouterV2
}

export async function calculateInitCodeHash(): Promise<string> {
    const provider = Provider.getDefaultProvider()
    const wallet = new Wallet(ALICE_PRIVATE_KEY, provider)
    const deployer = new Deployer(hre, wallet)

    const UniswapV2Pair = await deployer.loadArtifact('UniswapV2Pair')

    let initCodeHash = utils.hashBytecode(UniswapV2Pair.bytecode)
    let initCodeHashHex = "0x" + Buffer.from(initCodeHash).toString('hex')
    return initCodeHashHex
    
}