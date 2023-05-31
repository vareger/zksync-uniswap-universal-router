import hre from 'hardhat'
// const { ethers } = hre
import { UniversalRouter, Permit2 } from '../../../typechain'
import { Wallet, Provider } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

import {
    ALICE_PRIVATE_KEY,
    ZERO_ADDRESS,
    V2_FACTORY_MAINNET,
    V3_FACTORY_MAINNET,
    V2_INIT_CODE_HASH_MAINNET,
    V3_INIT_CODE_HASH_MAINNET,
} from './constants'

export async function deployRouter(
    permit2: Permit2,
    weth9Address: string,
    v2FactoryAddress: string,
    mockLooksRareRewardsDistributor?: string,
    mockLooksRareToken?: string
): Promise<UniversalRouter> {
    mockLooksRareRewardsDistributor
    mockLooksRareToken
    const routerParameters = {
        permit2: permit2.address,
        weth9: weth9Address,
        seaport: ZERO_ADDRESS,
        nftxZap: ZERO_ADDRESS,
        x2y2: ZERO_ADDRESS,
        foundation: ZERO_ADDRESS,
        sudoswap: ZERO_ADDRESS,
        nft20Zap: ZERO_ADDRESS,
        cryptopunks: ZERO_ADDRESS,
        looksRare: ZERO_ADDRESS,
        routerRewardsDistributor: ZERO_ADDRESS,
        looksRareRewardsDistributor: ZERO_ADDRESS,
        looksRareToken: ZERO_ADDRESS,
        v2Factory: v2FactoryAddress,
        v3Factory: V3_FACTORY_MAINNET,
        pairInitCodeHash: V2_INIT_CODE_HASH_MAINNET,
        poolInitCodeHash: V3_INIT_CODE_HASH_MAINNET,
    }
    console.log(`Running deploy script for the UniversalRouter contract`)

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

export async function deployPermit2(): Promise<Permit2> {
    console.log(`Running deploy script for the Permit2 contract`)

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
    const router = await deployRouter(permit2, ZERO_ADDRESS, ZERO_ADDRESS, mockLooksRareRewardsDistributor, mockLooksRareToken)
    return [router, permit2]
}
