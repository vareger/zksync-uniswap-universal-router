import deployZkSyncEra from '../deploy_zksync_era'

const ROUTER_PARAMS = {
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    weth9: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889',
    seaport: undefined,
    seaportV1_4: undefined,
    openseaConduit: undefined,
    nftxZap: undefined,
    x2y2: undefined,
    foundation: undefined,
    sudoswap: undefined,
    elementMarket: undefined,
    nft20Zap: undefined,
    cryptopunks: undefined,
    looksRareV2: undefined,
    routerRewardsDistributor: undefined,
    looksRareRewardsDistributor: undefined,
    looksRareToken: undefined,
    v2Factory: undefined,
    v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    pairInitCodeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    poolInitCodeHash: '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54'
}

const UNSUPPORTED_ADDRESS = undefined

export default async function deployZkSyncEraTestnet(taskArgs: any) {
    await deployZkSyncEra(taskArgs, ROUTER_PARAMS, UNSUPPORTED_ADDRESS)
}