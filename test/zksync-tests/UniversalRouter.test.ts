import { Permit2, UniversalRouter,  } from '../../typechain';
import {
    ALICE_PRIVATE_KEY
} from './shared/constants';
import hre, {  } from 'hardhat';
import "@matterlabs/hardhat-zksync-chai-matchers";
import { deployPermit2, deployRouter} from './shared/deployUniversalRouter';
import { Wallet, Provider, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { expandTo18DecimalsBN } from './shared/helpers';
import { RoutePlanner, CommandType} from './shared/planner';
import { expect } from 'chai';



/**
 * $ yarn hardhat test test/zksync-tests/UniversalRouter.test.ts --network zkSyncLocalhost
 */
describe('UniversalRouter Test:', () => {
    let provider: Provider;
    let alice: Wallet;
    let permit2: Permit2;
    let router: Contract;
    let erc20: Contract;
    let erc1155: Contract;
    let callback: Contract;
    let interfaceIDs: Contract;
    let planner: RoutePlanner;
    let deployer: Deployer;

    beforeEach(async () => {
        
        provider = Provider.getDefaultProvider();
        alice = new Wallet(ALICE_PRIVATE_KEY, provider);
        deployer = new Deployer(hre, alice);

        const MockERC20 = await deployer.loadArtifact("MockERC20");
        const MockERC1155 = await deployer.loadArtifact("MockERC1155");
        const Callback = await deployer.loadArtifact("Callbacks");
        const InterfaceIDs = await deployer.loadArtifact("InterfaceIDs");
    
        erc20 = await deployer.deploy(MockERC20, [18]);
        erc20 = new Contract(erc20.address, MockERC20.abi, alice);
        
        erc1155 = await deployer.deploy(MockERC1155, [alice.address]);
        erc1155 = new Contract(erc1155.address, MockERC1155.abi, alice);

        callback = await deployer.deploy(Callback, []);
        callback = new Contract(callback.address, Callback.abi, alice);

        interfaceIDs = await deployer.deploy(InterfaceIDs, []);
        interfaceIDs = new Contract(interfaceIDs.address, InterfaceIDs.abi, alice);

        permit2 = (await deployPermit2()).connect(alice) as Permit2;
        router = (await deployRouter(permit2)).connect(alice) as UniversalRouter;
        
        await erc20.connect(alice).mint(alice.address, expandTo18DecimalsBN(1));
        
        
        planner = new RoutePlanner();
    })

    
    it('testSweepToken', async () => {
        await (await erc20.connect(alice).mint(router.address, expandTo18DecimalsBN(1))).wait();

        expect((await erc20.balanceOf(router.address)).toString()).to.be.equal('1000000000000000000');
        
        planner.addCommand(CommandType.SWEEP, [erc20.address, alice.address, expandTo18DecimalsBN(1)]);
        const { commands, inputs } = planner;
        await(await router['execute(bytes,bytes[])'](commands, inputs)).wait();

        expect((await erc20.balanceOf(router.address)).toString()).to.be.equal('0');
        expect((await erc20.balanceOf(alice.address)).toString()).to.be.equal('2000000000000000000');
        
        
    })   

    it('testSweepTokenInsufficientOutput', async () => {
        await(await erc20.connect(alice).mint(router.address, expandTo18DecimalsBN(1))).wait();
        
        await expect((await erc20.balanceOf(router.address)).toString()).to.be.equal('1000000000000000000');
        
      
        planner.addCommand(CommandType.SWEEP, [erc20.address, alice.address, expandTo18DecimalsBN(2)]);
        const { commands, inputs } = planner;
        await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(router, 'InsufficientToken');;
    
        
        
    })   

    
    it('testSweepETH', async () => {
        await expect(() =>
            alice.transfer({
                to: router.address,
                amount: expandTo18DecimalsBN(1000000000),
            })
        ).to.changeEtherBalance(alice.address, expandTo18DecimalsBN(-1000000000));

        
        planner.addCommand(CommandType.SWEEP, ['0x0000000000000000000000000000000000000000', alice.address, expandTo18DecimalsBN(1000000000)]);
        const { commands, inputs } = planner;
        await expect(await router['execute(bytes,bytes[])'](commands, inputs)).to.changeEtherBalance(alice.address, expandTo18DecimalsBN(1000000000));
        
    })  

    it('testSweepETHInsufficientOutput', async () => {
        
        planner.addCommand(CommandType.SWEEP, ['0x0000000000000000000000000000000000000000', alice.address, expandTo18DecimalsBN(1000000001)]);
        const { commands, inputs } = planner;
        const value = expandTo18DecimalsBN(1000000000);
        await expect(router['execute(bytes,bytes[])'](commands, inputs, {value})).to.be.revertedWithCustomError(router, 'InsufficientETH');
        
    })  

    it('testSweepERC1155NotFullAmount', async () => {
        await ( await erc1155.connect(alice).mint(router.address, 1, expandTo18DecimalsBN(1))).wait();
        
        expect((await erc1155.balanceOf(router.address, 1)).toString()).to.be.equal('1000000000000000000');
        
        planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, alice.address, 1, expandTo18DecimalsBN(0.5)]);
        const { commands, inputs } = planner;
        await( await router['execute(bytes,bytes[])'](commands, inputs)).wait();

        expect((await erc1155.balanceOf(router.address, 1)).toString()).to.be.equal('0');
        expect((await erc1155.balanceOf(alice.address, 1)).toString()).to.be.equal('1000000000000000000');
        
        
    })   

    it('testSweepERC1155', async () => {
        await(await erc1155.connect(alice).mint(router.address, 1, expandTo18DecimalsBN(1))).wait();
        
        expect((await erc1155.balanceOf(router.address, 1)).toString()).to.be.equal('1000000000000000000');
        
        planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, alice.address, 1, expandTo18DecimalsBN(1)]);
        const { commands, inputs } = planner;
        await(await router['execute(bytes,bytes[])'](commands, inputs)).wait();

        expect((await erc1155.balanceOf(router.address, 1)).toString()).to.be.equal('0');
        expect((await erc1155.balanceOf(alice.address, 1)).toString()).to.be.equal('1000000000000000000');
        
        
    })   

    it('testSweepERC1155', async () => {
        await(await erc1155.connect(alice).mint(router.address, 1, expandTo18DecimalsBN(1))).wait();
        
        expect((await erc1155.balanceOf(router.address, 1)).toString()).to.be.equal('1000000000000000000');
        
        planner.addCommand(CommandType.SWEEP_ERC1155, [erc1155.address, alice.address, 1, expandTo18DecimalsBN(2)]);
        const { commands, inputs } = planner;
        await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWithCustomError(router, 'InsufficientToken');
        
        
    })   

    it('testSupportsInterface', async () => {
        let IERC1155ID =await interfaceIDs.getIERC1155InterfaceId();
        expect((await callback.supportsInterface(IERC1155ID)).toString()).to.be.equal('true');
        
        
        let IERC721ID =await interfaceIDs.getIERC721InterfaceId();
        expect((await callback.supportsInterface(IERC721ID)).toString()).to.be.equal('true');
        
        let IERC165ID =await interfaceIDs.getIERC165InterfaceId();
        expect((await callback.supportsInterface(IERC165ID)).toString()).to.be.equal('true');
        
    })  
  
})