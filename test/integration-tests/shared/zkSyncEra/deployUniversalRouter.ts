import {UniversalRouter, Permit2} from '../../../../typechain'
import {
    LOOKSRARE_REWARDS_DISTRIBUTOR,
    LOOKSRARE_TOKEN,
} from './constants'
import {deployContract} from "./zkSyncUtils";

export async function deployRouter(
    permit2: Permit2,
    mockLooksRareRewardsDistributor?: string,
    mockLooksRareToken?: string,
    mockReentrantProtocol?: string,
    WETH?: string,
    seaPort?: string,
    x2y2?: string,
    foundation?: string,
    sudoswap?: string,
    nft20Zap?: string,
    cryptopunks?: string,
    looksRare?: string,
    routerRewardsDistributor?: string,
    v2Factory?: string,
    v3Factory?: string,
    pairInitCodeHash?: string,
    poolInitCodeHash?: string
): Promise<UniversalRouter> {
    const routerParameters = {
        permit2: permit2.address,
        weth9: WETH,
        seaport: seaPort,
        nftxZap: mockReentrantProtocol ?? '0x0fc584529a2AEfA997697FAfAcbA5831faC0c22d',
        x2y2: x2y2,
        foundation: foundation,
        sudoswap: sudoswap,
        nft20Zap: nft20Zap,
        cryptopunks: cryptopunks,
        looksRare: looksRare,
        routerRewardsDistributor: routerRewardsDistributor,
        looksRareRewardsDistributor: mockLooksRareRewardsDistributor ?? LOOKSRARE_REWARDS_DISTRIBUTOR,
        looksRareToken: mockLooksRareToken ?? LOOKSRARE_TOKEN,
        v2Factory: v2Factory,
        v3Factory: v3Factory,
        pairInitCodeHash: pairInitCodeHash,
        poolInitCodeHash: poolInitCodeHash,
    }

    return <UniversalRouter>await deployContract("UniversalRouter", [routerParameters])
}

export default deployRouter

export async function deployPermit2(): Promise<Permit2> {
    return <Permit2>await deployContract("Permit2");
}
