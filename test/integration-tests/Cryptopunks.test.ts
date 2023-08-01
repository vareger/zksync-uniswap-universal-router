import { CommandType, RoutePlanner } from './shared/planner';
import { UniversalRouter, Permit2 } from '../../typechain';
import { ALICE_ADDRESS, DEADLINE, ZERO_ADDRESS } from './shared/constants';
import {
  ALICE_PRIVATE_KEY
} from './shared/constants';
import hre from 'hardhat';
import { BigNumber } from 'ethers';
import { expect } from 'chai';
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Wallet, Provider, Contract } from 'zksync-web3';


describe('Cryptopunks', () => {
  let provider: Provider;
  let alice: Wallet;
  let router: UniversalRouter;
  let permit2: Permit2;
  let planner: RoutePlanner;
  let cryptopunks: Contract;
  let deployer: Deployer;

  beforeEach(async () => {
    planner = new RoutePlanner();
    provider = Provider.getDefaultProvider();
    alice = new Wallet(ALICE_PRIVATE_KEY, provider);
    deployer = new Deployer(hre, alice);
    const MockCryptopunks = await deployer.loadArtifact('MockCryptopunks');

    cryptopunks = await deployer.deploy(MockCryptopunks, [ALICE_ADDRESS]);
    cryptopunks = new Contract(cryptopunks.address, MockCryptopunks.abi, alice);

    permit2 = (await deployPermit2()).connect(alice) as Permit2;
    router = (await deployUniversalRouter(
      permit2,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      cryptopunks.address
    )).connect(alice) as UniversalRouter;
  })

  describe('Buy 1 crypto punk', () => {
    it('purchases token ids 2976', async () => {
      const value = BigNumber.from('74950000000000000000');
      planner.addCommand(CommandType.CRYPTOPUNKS, [2976, ALICE_ADDRESS, value]);
      const { commands, inputs } = planner;


      await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value })).wait();

      // Expect that alice has the NFT
      let testAddress = await cryptopunks.punkIndexToAddress(2976);
      await expect(testAddress).to.eq(ALICE_ADDRESS);

    })
  })
})
