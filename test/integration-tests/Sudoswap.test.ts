import { CommandType, RoutePlanner } from './shared/planner';
import SUDOSWAP_ABI from './shared/abis/Sudoswap.json';
import { UniversalRouter, Permit2 } from '../../typechain';
import { ALICE_ADDRESS, DEADLINE, ZERO_ADDRESS } from './shared/constants';
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter';
import { ALICE_PRIVATE_KEY } from './shared/constants';
import hre from 'hardhat';
import { BigNumber } from 'ethers';
import { Wallet, Provider, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { expect } from 'chai';

const { ethers } = hre;

const SUDOSWAP_INTERFACE = new ethers.utils.Interface(SUDOSWAP_ABI);

describe('Sudoswap', () => {
  let provider: Provider;
  let alice: Wallet;
  let router: Contract;
  let permit2: Permit2;
  let planner: RoutePlanner;
  let deployer: Deployer;
  let mockSudoswap: Contract;

  beforeEach(async () => {
    provider = Provider.getDefaultProvider();
    alice = new Wallet(ALICE_PRIVATE_KEY, provider);
    deployer = new Deployer(hre, alice);

    const MockSudoswap = await deployer.loadArtifact('MockSudoswap');

    mockSudoswap = await deployer.deploy(MockSudoswap, [alice.address]);
    mockSudoswap = new Contract(mockSudoswap.address, MockSudoswap.abi, alice);


    permit2 = (await deployPermit2()).connect(alice) as Permit2;
    router = (await deployUniversalRouter(
      permit2,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      mockSudoswap.address
    )).connect(alice) as UniversalRouter;
    planner = new RoutePlanner();
  })

  // In this test we will buy token ids 80, 35, 93 of Sudolets (0xfa9937555dc20a020a161232de4d2b109c62aa9c),
  // which costs 0.073 ETH (exactly 73337152777777783 wei)
  describe('Buy 3 sudolets from sudoswap', () => {

    it('purchases token ids 80, 35, 93 of Sudolets', async () => {
      const value = BigNumber.from('73337152777777783');
      const calldata = SUDOSWAP_INTERFACE.encodeFunctionData('robustSwapETHForSpecificNFTs', [
        [[['0x339e7004372e04b1d59443f0ddc075efd9d80360', ['80', '35', '93']], '73337152777777783']],
        ALICE_ADDRESS,
        ALICE_ADDRESS,
        1665685098,
      ]);
      planner.addCommand(CommandType.SUDOSWAP, [value, calldata]);
      const { commands, inputs } = planner;

      await (
        await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: value })
      ).wait();

      // Expect that alice has the NFTs
      await expect(await mockSudoswap.ownerOf(80)).to.eq(ALICE_ADDRESS);
      await expect(await mockSudoswap.ownerOf(35)).to.eq(ALICE_ADDRESS);
      await expect(await mockSudoswap.ownerOf(93)).to.eq(ALICE_ADDRESS);
    })
  })
})
