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
    .addParam('params', "Path to params json")
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
    metadata: {
      bytecodeHash: 'none',
    },
  },
}


let UNISWAPV3_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    viaIR: false,
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
    libraries: {
      "lib/uniswapV3-zksync/contracts/libraries/NFTDescriptor.sol" : {
        NFTDescriptor: "0x0000000000000000000000000000000000000000"
      },
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}


export default {
  paths: {
    sources: './contracts',
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
      chainId: 1,
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
        blockNumber: 15360000,
      },
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    arbitrumRinkeby: {
      url: `https://rinkeby.arbitrum.io/rpc`,
    },
    arbitrum: {
      url: `https://arb1.arbitrum.io/rpc`,
    },
    optimismKovan: {
      url: `https://kovan.optimism.io`,
    },
    optimism: {
      url: `https://mainnet.optimism.io`,
    },
    zkSyncLocalhost: {
      url: "http://localhost:3050",
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
  namedAccounts: {
    deployer: 0,
  },
  solidity: {
    compilers: [
      UNISWAPV3_COMPILER_SETTINGS,  // 0.7.6
      DEFAULT_COMPILER_SETTINGS,    // 0.8.17
    ],
    overrides: {
      "lib/uniswapV3-zksync/contracts/libraries/BitMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/FixedPoint96.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/FixedPoint128.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/FullMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/LiquidityMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/LowGasSafeMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/Oracle.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/Position.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/SafeCast.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/SqrtPriceMath.sol" : UNISWAPV3_COMPILER_SETTINGS,   
      "lib/uniswapV3-zksync/contracts/libraries/SwapMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/Tick.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/TickBitmap.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/TickMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/TransferHelper.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/UnsafeMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/base/PeripheryPayments.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/base/PeripheryPaymentsWithFee.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/base/SelfPermit.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/lens/TickLens.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/BytesLib.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/ChainId.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/LiquidityAmounts.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/NFTDescriptor.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/NFTSVG.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/OracleLibrary.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/Path.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/PoolAddress.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/PoolTicksCounter.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/uniswapV3-zksync/contracts/libraries/PositionKey.sol" : UNISWAPV3_COMPILER_SETTINGS,

    }
  },
  zksolc: {
    version: "1.3.10",
    compilerSource: "binary",
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
    },
  },
  mocha: {
    timeout: 100000,
  },
}
