import { BigNumber } from 'ethers'
import bn from 'bignumber.js'
import { Contract } from '@ethersproject/contracts'

export function expandTo18DecimalsBN(n: number): BigNumber {
  // use bn intermediately to allow decimals in intermediate calculations
  return BigNumber.from(new bn(n).times(new bn(10).pow(18)).toFixed())
}

export function expandTo6DecimalsBN(n: number): BigNumber {
  // use bn intermediately to allow decimals in intermediate calculations
  return BigNumber.from(new bn(n).times(new bn(10).pow(6)).toFixed())
}

export function isTokenOrderCorrect(first: Contract, second: Contract): boolean {
  return first.address.toLowerCase() < second.address.toLowerCase()
}
