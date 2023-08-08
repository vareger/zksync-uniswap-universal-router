import { Wallet } from 'zksync-web3'
import * as ethers from 'ethers'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import * as fs from 'fs'

export default async function deployZkSyncEra(args: any) {
  console.log(`Running deploy script for the UniversalRouter contract`)

  const wallet = new Wallet(args.privateKey)

  const hre = require('hardhat')
  const deployer = new Deployer(hre, wallet)

  console.log(`Deploying the UnsupportedProtocol contract`)

  const unsupportedProtocolArtifact = await deployer.loadArtifact(
    'contracts/deploy/UnsupportedProtocol.sol:UnsupportedProtocol'
  )

  const unsupportedProtocolDeploymentFee = await deployer.estimateDeployFee(unsupportedProtocolArtifact, [])

  const unsupportedProtocolParsedFee = ethers.utils.formatEther(unsupportedProtocolDeploymentFee.toString())
  console.log(`The deployment is estimated to cost ${unsupportedProtocolParsedFee} ETH`)

  const unsupportedProtocol = await deployer.deploy(unsupportedProtocolArtifact)
  const unsupported = unsupportedProtocol.address
  console.log(`${unsupportedProtocolArtifact.contractName} was deployed to ${unsupported}`)

  if (args.verify) {
    await hre.run('verify:verify', {
      address: unsupported,
      contract: 'contracts/deploy/UnsupportedProtocol.sol:UnsupportedProtocol',
      constructorArguments: [],
    })
  }

  let params: any = fetchParameters(args.params)
  params = {
    permit2: mapUnsupported(params.permit2, unsupported),
    weth9: mapUnsupported(params.weth9, unsupported),
    seaport: mapUnsupported(params.seaport, unsupported),
    nftxZap: mapUnsupported(params.nftxZap, unsupported),
    x2y2: mapUnsupported(params.x2y2, unsupported),
    foundation: mapUnsupported(params.foundation, unsupported),
    sudoswap: mapUnsupported(params.sudoswap, unsupported),
    nft20Zap: mapUnsupported(params.nft20Zap, unsupported),
    cryptopunks: mapUnsupported(params.cryptopunks, unsupported),
    looksRare: mapUnsupported(params.looksRare, unsupported),
    routerRewardsDistributor: mapUnsupported(params.routerRewardsDistributor, unsupported),
    looksRareRewardsDistributor: mapUnsupported(params.looksRareRewardsDistributor, unsupported),
    looksRareToken: mapUnsupported(params.looksRareToken, unsupported),
    v2Factory: mapUnsupported(params.v2Factory, unsupported),
    v3Factory: mapUnsupported(params.v3Factory, unsupported),
    pairInitCodeHash: params.pairInitCodeHash,
    poolInitCodeHash: params.poolInitCodeHash,
  }

  console.log('routerParams: ')
  console.log(params)

  const artifact = await deployer.loadArtifact('contracts/UniversalRouter.sol:UniversalRouter')

  const deploymentFee = await deployer.estimateDeployFee(artifact, [params])

  const parsedFee = ethers.utils.formatEther(deploymentFee.toString())
  console.log(`The UniversalRouter deployment is estimated to cost ${parsedFee} ETH`)

  const universalRouter = await deployer.deploy(artifact, [params])

  const universalRouterAddress = universalRouter.address
  console.log(`${artifact.contractName} was deployed to ${universalRouterAddress}`)

  if (args.verify) {
    await hre.run('verify:verify', {
      address: universalRouterAddress,
      contract: 'contracts/UniversalRouter.sol:UniversalRouter',
      constructorArguments: [params],
    })
  }
}

function fetchParameters(pathToJSON: string): any {
  return JSON.parse(fs.readFileSync(pathToJSON, 'utf8'))
}

function mapUnsupported(address: string, unsupported: string): string {
  return address === '0x0000000000000000000000000000000000000000' ? unsupported : address
}
