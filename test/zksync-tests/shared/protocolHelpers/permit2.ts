import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Signature } from 'ethers'
import hre from 'hardhat'
import { Permit2 } from '../../../../typechain'
import { Wallet, Provider, utils } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

import {ethers} from 'ethers'
import { arrayify, keccak256 } from 'ethers/lib/utils'
import ethcrypto from 'eth-crypto'
import { BOB_PRIVATE_KEY } from '../constants'

const chainId: number = hre.network.config.chainId ? hre.network.config.chainId : 1

const _PERMIT_DETAILS_TYPEHASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"));

const _PERMIT_SINGLE_TYPEHASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"));

const _HASHED_NAME = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Permit2"));

const _TYPE_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EIP712Domain(string name,uint256 chainId,address verifyingContract)"));

const _PERMIT_BATCH_TYPEHASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PermitBatch(PermitDetails[] details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"));


export type PermitDetails = {
  token: string
  amount: number | BigNumber
  expiration: number | BigNumber
  nonce: number | BigNumber
}

export type PermitSingle = {
  details: PermitDetails
  spender: string
  sigDeadline: number | BigNumber
}

export type PermitBatch = {
  details: PermitDetails[]
  spender: string
  sigDeadline: number | BigNumber
}

export type TransferDetail = {
  from: string
  to: string
  amount: number | BigNumber
  token: string
}

export const PERMIT2_PERMIT_TYPE = {
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
}

export const PERMIT2_PERMIT_BATCH_TYPE = {
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
  PermitBatch: [
    { name: 'details', type: 'PermitDetails[]' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
}

export function getEip712Domain(chainId: number, verifyingContract: string) {
  return {
    name: 'Permit2',
    chainId,
    verifyingContract,
  }
}

export async function getPermitSignature(
  permitSingle: PermitSingle,
  signer: ethers.utils.SigningKey,
  permit2: Permit2
): Promise<string> {
  // look up the correct nonce for this permit
  const signerAddress = ethers.utils.computeAddress(signer.privateKey)
  const nextNonce = (await permit2.allowance(signerAddress, permitSingle.details.token, permitSingle.spender)).nonce;
  permitSingle.details.nonce = nextNonce;
  const provider = Provider.getDefaultProvider();
  const network = await provider.getNetwork();
  const chainId = network.chainId;
  const verifyingContract = permit2.address;
  const DOMAIN_SEPARATOR = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'uint256', 'address'], 
      [_TYPE_HASH, _HASHED_NAME, chainId, verifyingContract]
    )
  );
  const permitDetailsHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'address', 'uint160', 'uint48', 'uint48'], 
      [_PERMIT_DETAILS_TYPEHASH, permitSingle.details.token, permitSingle.details.amount, permitSingle.details.expiration, permitSingle.details.nonce]
    )
  );
  const permitSingleHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'address', 'uint256'], 
      [_PERMIT_SINGLE_TYPEHASH, permitDetailsHash, permitSingle.spender, permitSingle.sigDeadline]
    )
  );
  const hashTypedData = ethers.utils.keccak256(
    ethers.utils.hexConcat([
      ethers.utils.arrayify(ethers.utils.toUtf8Bytes('\x19\x01')), 
      DOMAIN_SEPARATOR, 
      permitSingleHash
    ])
  );
  const signature: Signature = signer.signDigest(hashTypedData)
  return signature.compact
}

export async function getPermitBatchSignature(
  permitBatch: PermitBatch,
  signer: ethers.utils.SigningKey,
  permit2: Permit2
): Promise<string> {
  for (const i in permitBatch.details) {
    let signerAddress = ethers.utils.computeAddress(signer.privateKey)
    const nextNonce = (await permit2.allowance(signerAddress, permitBatch.details[i].token, permitBatch.spender)).nonce
    permitBatch.details[i].nonce = nextNonce
  }
  const provider = Provider.getDefaultProvider();
  const network = await provider.getNetwork();
  const chainId = network.chainId;
  const verifyingContract = permit2.address;
  const DOMAIN_SEPARATOR = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'uint256', 'address'], 
      [_TYPE_HASH, _HASHED_NAME, chainId, verifyingContract]
    )
  );
  let permitDetailsHashes: any[] = []
  for(const i in permitBatch.details) {
    let detail = permitBatch.details[i]
    permitDetailsHashes[i] = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'address', 'uint160', 'uint48', 'uint48'], 
        [_PERMIT_DETAILS_TYPEHASH, detail.token, detail.amount, detail.expiration, detail.nonce]
      )
    );
  }
  
  const permitHashesHash = ethers.utils.keccak256(
    ethers.utils.hexConcat(permitDetailsHashes)
  );
  const permitBatchHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'address', 'uint256'], 
      [_PERMIT_BATCH_TYPEHASH, permitHashesHash, permitBatch.spender, permitBatch.sigDeadline]
    )
  );
  const hashTypedData = ethers.utils.keccak256(
    ethers.utils.hexConcat([
      ethers.utils.arrayify(ethers.utils.toUtf8Bytes('\x19\x01')), 
      DOMAIN_SEPARATOR, 
      permitBatchHash
    ])
  );
  const signature: Signature = signer.signDigest(hashTypedData)
  return signature.compact

}
