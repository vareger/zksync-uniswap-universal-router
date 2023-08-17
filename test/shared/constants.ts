import hre from 'hardhat'
const { ethers } = hre

// Router Helpers
export const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
export const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff'
export const DEADLINE = 2000000000
export const CONTRACT_BALANCE = '0x8000000000000000000000000000000000000000000000000000000000000000'
export const ALREADY_PAID = 0
export const ETH_ADDRESS = ethers.constants.AddressZero
export const ONE_PERCENT_BIPS = 100
export const MSG_SENDER: string = '0x0000000000000000000000000000000000000001'
export const ADDRESS_THIS: string = '0x0000000000000000000000000000000000000002'
export const SOURCE_MSG_SENDER: boolean = true
export const SOURCE_ROUTER: boolean = false

// Constructor Params
export const V3_INIT_CODE_HASH = '0x010013f177ea1fcbc4520f9a3ca7cd2d1d77959e05aa66484027cb38e712aeed'
export const V2_INIT_CODE_HASH = '0x0100065f2f2a556816a482652f101ddda2947216a5720dd91a79c61709cbf2b8'

export const ROUTER_REWARDS_DISTRIBUTOR = '0x0000000000000000000000000000000000000000'
