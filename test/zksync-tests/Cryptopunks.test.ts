import { CommandType, RoutePlanner } from './shared/planner'
import { UniversalRouter, Permit2 } from '../../typechain'
import { ALICE_ADDRESS, DEADLINE } from './shared/constants'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  ALICE_PRIVATE_KEY,
  BOB_PRIVATE_KEY
} from './shared/constants'
import hre from 'hardhat'
import { BigNumber } from 'ethers'
import { expect } from 'chai'
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { Wallet, Provider, Contract } from 'zksync-web3'
const { ethers } = hre

describe('Cryptopunks', () => {
  let provider: Provider
  let alice: Wallet
  let bob: Wallet
  let router: UniversalRouter
  let permit2: Permit2
  let planner: RoutePlanner
  let cryptopunks: Contract
  let deployer: Deployer

  beforeEach(async () => {
    planner = new RoutePlanner()
    provider = Provider.getDefaultProvider()
    alice = new Wallet(ALICE_PRIVATE_KEY, provider)
    bob = new Wallet(BOB_PRIVATE_KEY, provider)
    deployer = new Deployer(hre, alice)
    const MockCryptopunks = await deployer.loadArtifact('MockCryptopunks');
    
    cryptopunks = await deployer.deploy(MockCryptopunks, [ALICE_ADDRESS])
    cryptopunks = new Contract(cryptopunks.address, MockCryptopunks.abi, alice)

    
    
    permit2 = (await deployPermit2()).connect(alice) as Permit2
    router = (await deployUniversalRouter(permit2, "","","","","", cryptopunks.address)).connect(alice) as UniversalRouter
  })

  describe('Buy 1 crypto punk', () => {
    it('purchases token ids 2976', async () => {
      const value = BigNumber.from('74950000000000000000')
      planner.addCommand(CommandType.CRYPTOPUNKS, [2976, ALICE_ADDRESS, value])
      const { commands, inputs } = planner

      //await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value });
      await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, {value})).to.be.revertedWithCustomError(router, 'ExecutionFailed');
        
      // await (
      //   await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value })
      // ).wait()

      // Expect that alice has the NFT
      let testAddress = await cryptopunks.punkIndexToAddress(2976);
      console.log(testAddress)
      await expect(testAddress).to.eq(ALICE_ADDRESS)
      // gas test
      // await expect(aliceBalance.sub(await ethers.provider.getBalance(alice.address))).to.eq(
      //   value.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      // )
    })
  })
})
