import hre from 'hardhat'
const { ethers } = hre
import { BigNumber } from 'ethers'

// Router Helpers
export const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
export const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff'
export const DEADLINE = 2000000000
export const CONTRACT_BALANCE = '0x8000000000000000000000000000000000000000000000000000000000000000'
export const ALREADY_PAID = 0
export const ALICE_PRIVATE_KEY = '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110'
export const ALICE_ADDRESS = '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049'
export const BOB_PRIVATE_KEY = '0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3'
export const BOB_ADDRESS = '0xa61464658AfeAf65CccaaFD3a512b69A83B77618'
export const ETH_ADDRESS = ethers.constants.AddressZero
export const ZERO_ADDRESS= ethers.constants.AddressZero
export const ONE_PERCENT_BIPS = 100
export const MSG_SENDER: string = '0x0000000000000000000000000000000000000001'
export const ADDRESS_THIS: string = '0x0000000000000000000000000000000000000002'
export const SOURCE_MSG_SENDER: boolean = true
export const SOURCE_ROUTER: boolean = false

// Constructor Params
export const V2_FACTORY_MAINNET = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
export const V3_FACTORY_MAINNET = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
export const V3_INIT_CODE_HASH_MAINNET = '0x010013edafc248ef0e78ae201686f34525d09a388a0621bab31f8bdf7ceff879'
export const V2_INIT_CODE_HASH_MAINNET = '0x010005912ea0e4d14673314355e60e88442135b7cd9becdb11d53187c526492f'

export const NFTX_COVEN_VAULT = '0xd89b16331f39ab3878daf395052851d3ac8cf3cd'
export const NFTX_COVEN_VAULT_ID = '333'
export const ROUTER_REWARDS_DISTRIBUTOR = '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049'
export const LOOKSRARE_REWARDS_DISTRIBUTOR = '0x0000000000000000000000000000000000000000'
export const LOOKSRARE_TOKEN = '0x0000000000000000000000000000000000000000'

export const OPENSEA_CONDUIT = '0x1e0049783f008a0085193e00003d00cd54003c71'
export const OPENSEA_CONDUIT_KEY = '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000'


export const NFTX_ERC_1155_VAULT_ID = '61'

export const MaxUint128 = BigNumber.from(2).pow(128).sub(1)

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
}