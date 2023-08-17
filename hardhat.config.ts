import 'hardhat-typechain'
import '@nomiclabs/hardhat-ethers'
import '@matterlabs/hardhat-zksync-deploy'
import '@matterlabs/hardhat-zksync-solc'
import '@matterlabs/hardhat-zksync-verify'
import '@matterlabs/hardhat-zksync-chai-matchers'
import { task } from 'hardhat/config'
import deployZkSyncEra from './script/deploy_zksync_era'
import dotenv from 'dotenv'
dotenv.config()

const ZK_SYNC_LOCALHOST = "http://localhost:8011"
// This variable is used by the hardhat-zksync-chai-matchers
process.env.ZKSYNC_WEB3_API_URL = ZK_SYNC_LOCALHOST

task('deployZkSyncEra')
  .addParam('privateKey', 'Private key used to deploy')
  .addParam('params', 'Path to params json')
  .addFlag('verify', 'Whether verify the contracts')
  .setAction(async (taskArgs) => {
    await deployZkSyncEra(taskArgs)
  })

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.8.17',
  settings: {
    viaIR: true,
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
  },
}

export default {
  paths: {
    sources: './contracts',
  },
  networks: {
    zkSyncLocalhost: {
      url: process.env.ZKSYNC_WEB3_API_URL,
      ethNetwork: '',
      zksync: true,
    },
    zkSyncTestnet: {
      url: 'https://testnet.era.zksync.dev',
      ethNetwork: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      zksync: true,
      verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification',
    },
    zkSyncMainnet: {
      url: 'https://mainnet.era.zksync.io',
      ethNetwork: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      zksync: true,
      verifyURL: 'https://zksync2-mainnet-explorer.zksync.io/contract_verification',
    },
  },
  defaultNetwork: 'zkSyncLocalhost',
  namedAccounts: {
    deployer: 0,
  },
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
  },
  zksolc: {
    version: "1.3.13",
    compilerSource: "binary",
    settings: {},
  },
  mocha: {
    timeout: 100000,
  },
}
