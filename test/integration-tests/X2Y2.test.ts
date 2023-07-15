import { CommandType, RoutePlanner } from './shared/planner';
import { UniversalRouter, Permit2 } from '../../typechain';
import { 
    ALICE_ADDRESS, 
    ALICE_PRIVATE_KEY,
    DEADLINE, 
    ZERO_ADDRESS
} from './shared/constants';
import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter';
import hre from 'hardhat';
import { expect } from 'chai';
import { X2Y2Order, x2y2Orders, X2Y2_INTERFACE } from './shared/protocolHelpers/x2y2';
import { Wallet, Provider, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';


describe('X2Y2', () => {
  let provider: Provider;
  let alice: Wallet;
  let router: UniversalRouter;
  let permit2: Permit2;
  let x2y2: Contract;
  let ens: Contract;
  let cameo: Contract;
  let planner: RoutePlanner;

  before(async () => {
   
    provider = Provider.getDefaultProvider();
    alice = new Wallet(ALICE_PRIVATE_KEY, provider);
    let deployer = new Deployer(hre, alice);

    const MockX2Y2 = await deployer.loadArtifact("MockX2Y2");
    const MockERC1155 = await deployer.loadArtifact("MockERC1155");
    const MockENS721 = await deployer.loadArtifact("MockENS721");

    x2y2 = await deployer.deploy(MockX2Y2, []);
    ens = await deployer.deploy(MockENS721, [alice.address]);
    cameo = await deployer.deploy(MockERC1155, [alice.address]);
  })

  beforeEach(async() => {
    planner = new RoutePlanner();
  })

  describe('ERC-721 purchase', () => {
    let commands: string;
    let inputs: string[];
    let erc721Order: X2Y2Order;

    beforeEach(async () => {

      permit2 = (await deployPermit2()).connect(alice) as Permit2;
      router = (await deployUniversalRouter(
        permit2,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        x2y2.address
      )).connect(alice) as UniversalRouter;

      erc721Order = x2y2Orders[0];
      const functionSelector = X2Y2_INTERFACE.getSighash(X2Y2_INTERFACE.getFunction('run'));
      const calldata = functionSelector + erc721Order.input.slice(2);

      await (await ens.connect(alice).mint(router.address, erc721Order.token_id)).wait();
      planner.addCommand(CommandType.X2Y2_721, [
        erc721Order.price,
        calldata,
        ALICE_ADDRESS,
        ens.address,
        erc721Order.token_id,
      ]);
      ({ commands, inputs } = planner);
    })

    it('purchases 1 ERC-721 on X2Y2', async () => {
      await (
        await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: erc721Order.price })
      ).wait();
      
      const newOwner = await ens.connect(alice).ownerOf(erc721Order.token_id);
      await expect(newOwner).to.eq(ALICE_ADDRESS);
    })
  })

  describe('ERC-1155 purchase', () => {
    let commands: string;
    let inputs: string[];
    let erc1155Order: X2Y2Order;

    beforeEach(async () => {
     
      permit2 = (await deployPermit2()).connect(alice) as Permit2;
      router = (await deployUniversalRouter(
        permit2,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        x2y2.address
      )).connect(alice) as UniversalRouter;

      erc1155Order = x2y2Orders[1]
      const functionSelector = X2Y2_INTERFACE.getSighash(X2Y2_INTERFACE.getFunction('run'));
      const calldata = functionSelector + erc1155Order.input.slice(2);
      
      await (await cameo.connect(alice).mint(router.address, erc1155Order.token_id, 1)).wait();
      planner.addCommand(CommandType.X2Y2_1155, [
        erc1155Order.price,
        calldata,
        ALICE_ADDRESS,
        cameo.address,
        erc1155Order.token_id,
        1,
      ]);
      ;({ commands, inputs } = planner);
    })

    it('purchases 1 ERC-1155 on X2Y2', async () => {
      await expect(await cameo.connect(alice).balanceOf(alice.address, erc1155Order.token_id)).to.eq(0);
      await (
        await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value: erc1155Order.price })
      ).wait();
      await expect(await cameo.connect(alice).balanceOf(alice.address, erc1155Order.token_id)).to.eq(1);
    })
  })
})
