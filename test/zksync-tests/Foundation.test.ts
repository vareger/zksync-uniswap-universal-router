import FOUNDATION_ABI from './shared/abis/Foundation.json';
import { Permit2 } from '../../typechain';
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter';
import { ALICE_PRIVATE_KEY, ALICE_ADDRESS, DEADLINE, ZERO_ADDRESS} from './shared/constants';
import hre from 'hardhat';
import { BigNumber } from 'ethers';
import { Wallet, Provider, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { expect } from 'chai';

import "@matterlabs/hardhat-zksync-chai-matchers";
import { CommandType, RoutePlanner } from './shared/planner';
const { ethers } = hre;

const FOUNDATION_INTERFACE = new ethers.utils.Interface(FOUNDATION_ABI);
const REFERRER = "0x459e213D8B5E79d706aB22b945e3aF983d51BC4C";

describe('Foundation', () => {
  let provider: Provider;
  let alice: Wallet;
  let router: Contract;
  let permit2: Permit2;
  let planner: RoutePlanner;
  let deployer: Deployer;
  let mentalWorld: Contract;
  let mockFoundation: Contract;

  beforeEach(async () => {
      provider = Provider.getDefaultProvider();
      alice = new Wallet(ALICE_PRIVATE_KEY, provider);
      deployer = new Deployer(hre, alice);
      planner = new RoutePlanner();

          
      const MockERC721 = await deployer.loadArtifact('MockERC721');
      const MockFoundation = await deployer.loadArtifact('MockFoundation');


      mentalWorld = await deployer.deploy(MockERC721, [alice.address]);
      mentalWorld = new Contract(mentalWorld.address, MockERC721.abi, alice);

      mockFoundation = await deployer.deploy(MockFoundation, [alice.address]);
      mockFoundation = new Contract(mockFoundation.address, MockFoundation.abi, alice);

      permit2 = (await deployPermit2()).connect(alice);
      router = (await deployUniversalRouter(
        permit2, 
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        mockFoundation.address
      )).connect(alice); 
  })

  // In this test we will buy token id 32 of mental worlds NFT (0xEf96021Af16BD04918b0d87cE045d7984ad6c38c),
  // which costs 0.01 ETH
  describe('Buy a mental worlds NFT from Foundation', () => {
    beforeEach(async () => {
      await(await mentalWorld.mint(router.address, 32)).wait();
    })

    it('purchases token id 32 of mental worlds', async () => {
      const value = BigNumber.from('1000000000000000000000');
      const calldata = FOUNDATION_INTERFACE.encodeFunctionData('buyV2', [mentalWorld.address, 32, value, REFERRER]);
      planner.addCommand(CommandType.FOUNDATION, [value, calldata, ALICE_ADDRESS, mentalWorld.address, 32]);
      const { commands, inputs } = planner;

      //const aliceBalance = await ethers.provider.getBalance(alice.address)
      await expect(
        await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value })
      ).to.changeEtherBalance(REFERRER, BigInt("+10000000000000000000"));
     
      
      // Expect that alice has the NFT
      await expect(await mentalWorld.connect(alice).ownerOf(32)).to.eq(ALICE_ADDRESS);
      // Expect that alice's account has 0.01 (plus gas) less ETH in it
      // await expect(aliceBalance.sub(await ethers.provider.getBalance(alice.address))).to.eq(
      //   value.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      // )
      // Expect that referrer's account has 0.0001 more ETH in it (referrers receive 1% of NFT value)
      //await expect((await ethers.provider.getBalance(REFERRER)).sub(referrerBalance)).to.eq(value.div(100))
    })
  })
})
