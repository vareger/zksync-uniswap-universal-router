import 'hardhat-typechain'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@matterlabs/hardhat-zksync-deploy'
import '@matterlabs/hardhat-zksync-solc'
import '@matterlabs/hardhat-zksync-verify'
import { task } from 'hardhat/config'
import deployZkSyncEra from './script/deploy_zksync_era'
import dotenv from 'dotenv'
dotenv.config()

task('deployZkSyncEra')
  .addParam('privateKey', 'Private key used to deploy')
  .addParam('params', 'Path to params json')
  .addFlag('verify', 'Whether verify the contracts')
  .setAction(async (taskArgs) => {
    await deployZkSyncEra(taskArgs)
  })

// const DEFAULT_COMPILER_SETTINGS = {
//   version: '0.8.17',
//   settings: {
//     viaIR: true,
//     evmVersion: 'istanbul',
//     optimizer: {
//       enabled: true,
//       runs: 1_000_000,
//     },
//     metadata: {
//       bytecodeHash: 'none',
//     },
//   },
// }

// export default {
//   paths: {
//     sources: './contracts',
//   },
//   networks: {
//     zkSyncLocalhost: {
//       url: 'http://localhost:3050',
//       ethNetwork: 'http://localhost:8545',
//       zksync: true,
//     },
//     zkSyncTestNode: {
//       url: "http://localhost:8011",
//       ethNetwork: "http://localhost:8545",
//       zksync: true,
//     },
//     zkSyncTestnet: {
//       url: 'https://testnet.era.zksync.dev',
//       ethNetwork: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
//       zksync: true,
//       verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification',
//     },
//     zkSyncMainnet: {
//       url: 'https://mainnet.era.zksync.io',
//       ethNetwork: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
//       zksync: true,
//       verifyURL: 'https://zksync2-mainnet-explorer.zksync.io/contract_verification',
//     },
//   },
//   defaultNetwork: 'zkSyncLocalhost',
//   namedAccounts: {
//     deployer: 0,
//   },
//   solidity: {
//     compilers: [DEFAULT_COMPILER_SETTINGS],
//   },
//   zksolc: {
//     version: '1.3.13',
//     compilerSource: 'binary',
//     settings: {
//       metadata: {
//         bytecodeHash: 'none',
//       },
//     },
//   },
//   mocha: {
//     timeout: 100000,
//   },
// }


export default {
  networks: {
    hardhat: {
      zksync: true
    },
    zkSyncLocalSetup: {
      url: "http://localhost:3050",
      ethNetwork: "http://localhost:8545",
      zksync: true,
    },
    zkSyncTestNode: {
      url: "http://localhost:8011",
      ethNetwork: "http://localhost:8545",
      zksync: true,
    },
    zkSyncTestnet: {
      url: "https://testnet.era.zksync.dev",
      ethNetwork: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      zksync: true,
      verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification'
    },
  },
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.7.6/metadata.html
        bytecodeHash: 'none',
      },
    },
  },
  paths: {
    sources: "./src"
  },
  zksolc: {
    version: "1.3.10",
    compilerSource: "binary",
    settings: {
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.7.6/metadata.html
        bytecodeHash: 'none',
      },
    },
  },
  mocha: {
    timeout: 1000000000000
  }
}