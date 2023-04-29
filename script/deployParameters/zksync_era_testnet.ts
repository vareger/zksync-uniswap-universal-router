import deployZkSyncEra from '../deploy_zksync_era'

const ROUTER_PARAMS = {
    permit2: '0x6fbAE87e7b6f624bF256b05A1eaF2D4D9B53E7ec',
    weth9: '0x440bac118befca196a87b0e0027137979a9549ce',
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
    v3Factory: '0x9c7E0Ee840CB5117FE16047Ed7e127ed50C62B9D',
    pairInitCodeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    poolInitCodeHash: '0x010013eddc3e59d6ce5c1429f6e115ca3d72a9b92bc824c814bb9f50a7fa4057'
}

const UNSUPPORTED_ADDRESS = '0x8dD5A45c35e85E26888f8b1c89d9A1e3fF9a982B'

export default async function deployZkSyncEraTestnet(taskArgs: any) {
    await deployZkSyncEra(taskArgs, ROUTER_PARAMS, UNSUPPORTED_ADDRESS)
}