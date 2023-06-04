import hre from 'hardhat'
// const { ethers } = hre
import {  Permit2, UniversalRouter } from '../../../typechain'
import { Wallet, Provider, Contract } from 'zksync-web3'
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
    seaportAddress?: string,
    nftxAddress?: string,
    mockERC20Address?: string,
    aliceAddress?: string,
    mockLooksRareRewardsDistributor?: string,
    cryptopunksAddress?: string,
    mockFoundationAddress?: string
): Promise<UniversalRouter> {
    
    
    const routerParameters = {
        permit2: permit2.address,
        weth9: ZERO_ADDRESS,
        seaport: seaportAddress || ZERO_ADDRESS,
        nftxZap: nftxAddress || ZERO_ADDRESS,
        x2y2: ZERO_ADDRESS,
        foundation: mockFoundationAddress || ZERO_ADDRESS,
        sudoswap: ZERO_ADDRESS,
        nft20Zap: ZERO_ADDRESS,
        cryptopunks: cryptopunksAddress || ZERO_ADDRESS,
        looksRare: ZERO_ADDRESS,
        routerRewardsDistributor: aliceAddress || ZERO_ADDRESS,
        looksRareRewardsDistributor: mockLooksRareRewardsDistributor || ZERO_ADDRESS,
        looksRareToken: mockERC20Address || ZERO_ADDRESS,
        v2Factory: V2_FACTORY_MAINNET,
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
    const router = await deployRouter(permit2, mockLooksRareRewardsDistributor, mockLooksRareToken)
    return [router, permit2]
}
