import { Wallet } from 'zksync-web3'
import * as ethers from 'ethers'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

export default async function deployZkSyncEra(taskArgs: any, routerParams: any, unsupportedAddress: string | undefined) {
    console.log(`Running deploy script for the UniversalRouter contract`);

    const wallet = new Wallet(taskArgs.privateKey)

    const hre = require('hardhat')
    const deployer = new Deployer(hre, wallet);
    
    if (unsupportedAddress === undefined) {
        console.log(`Deploying the UnsupportedProtocol contract`);
        
        const artifact = await deployer.loadArtifact("UnsupportedProtocol");

        const deploymentFee = await deployer.estimateDeployFee(artifact, []);

        const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
        console.log(`The deployment is estimated to cost ${parsedFee} ETH`);

        const unsupportedProtocol = await deployer.deploy(artifact);
        const contractAddress = unsupportedProtocol.address;
        console.log(`${artifact.contractName} was deployed to ${contractAddress}`);
        unsupportedAddress = contractAddress;
    }
    
    const routerParamsWithUnsupported = {
        permit2: mapUnsupported(routerParams.permit2, unsupportedAddress),
        weth9: mapUnsupported(routerParams.weth9, unsupportedAddress),
        seaport: mapUnsupported(routerParams.seaport, unsupportedAddress),
        seaportV1_4: mapUnsupported(routerParams.seaportV1_4, unsupportedAddress),
        openseaConduit: mapUnsupported(routerParams.openseaConduit, unsupportedAddress),
        nftxZap: mapUnsupported(routerParams.nftxZap, unsupportedAddress),
        x2y2: mapUnsupported(routerParams.x2y2, unsupportedAddress),
        foundation: mapUnsupported(routerParams.foundation, unsupportedAddress),
        sudoswap: mapUnsupported(routerParams.sudoswap, unsupportedAddress),
        elementMarket: mapUnsupported(routerParams.elementMarket, unsupportedAddress),
        nft20Zap: mapUnsupported(routerParams.nft20Zap, unsupportedAddress),
        cryptopunks: mapUnsupported(routerParams.cryptopunks, unsupportedAddress),
        looksRareV2: mapUnsupported(routerParams.looksRareV2, unsupportedAddress),
        routerRewardsDistributor: mapUnsupported(routerParams.routerRewardsDistributor, unsupportedAddress),
        looksRareRewardsDistributor: mapUnsupported(routerParams.looksRareRewardsDistributor, unsupportedAddress),
        looksRareToken: mapUnsupported(routerParams.looksRareToken, unsupportedAddress),
        v2Factory: mapUnsupported(routerParams.v2Factory, unsupportedAddress),
        v3Factory: mapUnsupported(routerParams.v3Factory, unsupportedAddress),
        pairInitCodeHash: routerParams.pairInitCodeHash,
        poolInitCodeHash: routerParams.poolInitCodeHash
    }

    console.log('routerParams: ')
    console.log(routerParamsWithUnsupported)

    const artifact = await deployer.loadArtifact("UniversalRouter");

    const deploymentFee = await deployer.estimateDeployFee(artifact, [routerParamsWithUnsupported]);

    const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
    console.log(`The UniversalRouter deployment is estimated to cost ${parsedFee} ETH`);

    const universalRouter = await deployer.deploy(artifact, [routerParamsWithUnsupported]);

    const contractAddress = universalRouter.address;
    console.log(`${artifact.contractName} was deployed to ${contractAddress}`);
}

function mapUnsupported(address: string | undefined, unsupported: string): string {
    return address === undefined ? unsupported : address
}