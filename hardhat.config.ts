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
    viaIR: true,
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
    libraries: {
      "lib/v3-periphery/contracts/libraries/NFTDescriptor.sol" : {
        NFTDescriptor: "0x0000000000000000000000000000000000000000"
      },
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

export default {
  defaultNetwork: "zkSyncLocalhost",
  allowUnlimitedContractSize: true,
  UNISWAPV3_COMPILER_SETTINGS,
  paths: {
    sources: './contracts',
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
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
      allowUnlimitedContractSize: true,
      gas: 36000000000000000000000000000000000,
      gasPrice: 100000000000000000000000000000
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
      "lib/v3-core/contracts/libraries/BitMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/FixedPoint96.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/FixedPoint128.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/FullMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/LiquidityMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/LowGasSafeMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/Oracle.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/Position.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/SafeCast.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/SqrtPriceMath.sol" : UNISWAPV3_COMPILER_SETTINGS,   
      "lib/v3-core/contracts/libraries/SwapMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/Tick.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/TickBitmap.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/TickMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/TransferHelper.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-core/contracts/libraries/UnsafeMath.sol" : UNISWAPV3_COMPILER_SETTINGS,

      "lib/v3-periphery/contracts/base/PeripheryPayments.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/base/PeripheryPaymentsWithFee.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/base/SelfPermit.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/lens/TickLens.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/BytesLib.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/ChainId.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/LiquidityAmounts.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/NFTDescriptor.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/NFTSVG.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/OracleLibrary.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/Path.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/PoolAddress.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/PoolTicksCounter.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/PositionKey.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "lib/v3-periphery/contracts/libraries/TransferHelper.sol" : UNISWAPV3_COMPILER_SETTINGS,

      "@uniswap/v3-core/contracts/libraries/BitMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/FixedPoint96.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/FixedPoint128.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/FullMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/LiquidityMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/Oracle.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/Position.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/SafeCast.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol" : UNISWAPV3_COMPILER_SETTINGS,   
      "@uniswap/v3-core/contracts/libraries/SwapMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/Tick.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/TickBitmap.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/TickMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/TransferHelper.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/v3-core/contracts/libraries/UnsafeMath.sol" : UNISWAPV3_COMPILER_SETTINGS,

      "@uniswap/lib/contracts/libraries/AddressStringUtil.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/lib/contracts/libraries/Babylonian.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/lib/contracts/libraries/BitMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/lib/contracts/libraries/FixedPoint.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/lib/contracts/libraries/FullMath.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/lib/contracts/libraries/SafeERC20Namer.sol" : UNISWAPV3_COMPILER_SETTINGS,
      "@uniswap/lib/contracts/libraries/TransferHelper.sol" : UNISWAPV3_COMPILER_SETTINGS,
      
      "base64-sol/base64.sol" : UNISWAPV3_COMPILER_SETTINGS
    
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
    timeout: 100000
  }
}
