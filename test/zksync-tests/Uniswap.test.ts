import { Permit2, UniswapV2Factory, UniswapV2Router02, UniversalRouter } from '../../typechain';
import {
    ALICE_PRIVATE_KEY,
    BOB_PRIVATE_KEY,
    MAX_UINT,
    DEADLINE,
    MSG_SENDER,
    SOURCE_MSG_SENDER,
    MAX_UINT160,
    ONE_PERCENT_BIPS,
    ETH_ADDRESS,
    SOURCE_ROUTER,
    ZERO_ADDRESS,
} from './shared/constants';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import hre from 'hardhat';
import { parseEvents, V2_EVENTS, V3_EVENTS } from './shared/parseEvents';
import { deployPermit2, deployRouter} from './shared/deployUniversalRouter';
import { deployUniswapV2, calculateInitCodeHash} from './shared/deployUniswapV2';
import { expect } from './shared/expect';
import { Wallet, Provider, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { expandTo18DecimalsBN, expandTo6DecimalsBN } from './shared/helpers';
import { RoutePlanner, CommandType} from './shared/planner';
import { getPermitSignature, PermitSingle} from './shared/protocolHelpers/permit2';
import { BigNumber, BigNumberish } from 'ethers';
import {ethers} from 'ethers';

/**
 * $ yarn hardhat test test/zksync-tests/Uniswap.test.ts --network zkSyncLocalhost
 */
describe('Uniswap V2:', () => {
    let provider: Provider;
    let alice: Wallet;
    let bob: Wallet;
    let permit2: Permit2;
    let router: UniversalRouter;
    let wethContract: Contract;
    let daiContract: Contract;
    let usdcContract: Contract;
    let planner: RoutePlanner;

    let uniswapV2Factory: UniswapV2Factory;
    let uniswapV2Router: UniswapV2Router02;

    before(async () => {
        
        provider = Provider.getDefaultProvider();
        alice = new Wallet(ALICE_PRIVATE_KEY, provider);
        bob = new Wallet(BOB_PRIVATE_KEY, provider);
        let deployer = new Deployer(hre, alice);

        const MockERC20 = await deployer.loadArtifact("MockERC20");
        const MockL2WETH = await deployer.loadArtifact("MockL2WETH");
        let dai = await deployer.deploy(MockERC20, [6]);
        let usdc = await deployer.deploy(MockERC20, [6]);
        let weth = await deployer.deploy(MockL2WETH, []);

        wethContract = new Contract(weth.address, MockL2WETH.abi, alice);
        daiContract = new Contract(dai.address, MockERC20.abi, alice);
        usdcContract = new Contract(usdc.address, MockERC20.abi, alice);
        // console.log("WETH address: " + wethContract.address);
        // console.log("DAI address: " + daiContract.address);
        // console.log("USDC address: " + usdcContract.address);

        let uniswapV2 = await deployUniswapV2(wethContract.address);
        uniswapV2Factory = uniswapV2[0];
        uniswapV2Router = uniswapV2[1];

        permit2 = (await deployPermit2()).connect(bob) as Permit2;
        router = (await deployRouter(
          permit2, 
          wethContract.address, 
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,   
          uniswapV2Factory.address
          )
        ).connect(bob) as UniversalRouter;
        planner = new RoutePlanner();

        // console.log("Permit2 address: " + permit2.address);
        // console.log("Universal router address: " + router.address);
        // console.log("Uniswap Factory address: " + uniswapV2Factory.address);
        // console.log("Uniswap Router address: " + uniswapV2Router.address);

        
        await (await wethContract.connect(alice).deposit({value: expandTo18DecimalsBN(11100)})).wait();
        //await new Promise(f => setTimeout(f, 5000));
        await (await wethContract.connect(alice).transfer(bob.address, expandTo18DecimalsBN(11100))).wait();
        await (await daiContract.connect(alice).mint(bob.address, expandTo18DecimalsBN(11000000))).wait();
        await (await usdcContract.connect(alice).mint(bob.address, expandTo6DecimalsBN(100000))).wait();

        await (await wethContract.connect(bob).approve(permit2.address, MAX_UINT)).wait();
        await (await daiContract.connect(bob).approve(permit2.address, MAX_UINT)).wait();
        await (await usdcContract.connect(bob).approve(permit2.address, MAX_UINT)).wait();

    })

    describe('UniswapV2 setup', () => {

        it('add liquidity DAI/USDC', async () => {

            // function addLiquidity(
            //     address tokenA,
            //     address tokenB,
            //     uint amountADesired,
            //     uint amountBDesired,
            //     uint amountAMin,
            //     uint amountBMin,
            //     address to,
            //     uint deadline
            // ) 

            let tokenA = daiContract.address;
            let tokenB = usdcContract.address;
            let amountADesired = expandTo18DecimalsBN(10_000_000);
            let amountBDesired = expandTo18DecimalsBN(10_000_000);
            let amountAMin = amountADesired;
            let amountBMin = amountBDesired;
            let to = alice.address;
            let deadline = Math.round((new Date()).getTime()/1000)+86400;
            await (await daiContract.connect(alice).mint(alice.address, amountADesired)).wait();
            await (await usdcContract.connect(alice).mint(alice.address, amountBDesired)).wait();
   
            // await new Promise(f => setTimeout(f, 4000));
            
            await (await daiContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait();
            await (await usdcContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait();
            
            //await new Promise(f => setTimeout(f, 4000));
         
            await(await uniswapV2Router.connect(alice).addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                to,
                deadline
            )).wait();

            let reserves = await uniswapV2Router.getReserves(tokenA, tokenB);

            expect(reserves[0]).to.be.eq(amountADesired);
            expect(reserves[1]).to.be.eq(amountBDesired);

        })

        it('add liquidity DAI/WETH', async () => {
            let tokenA = daiContract.address;
            let tokenB = wethContract.address;
            let amountADesired = expandTo18DecimalsBN(10_000_000);
            let amountBDesired = expandTo18DecimalsBN(1_00_000);
            let amountAMin = amountADesired;
            let amountBMin = amountBDesired;
            let to = alice.address;
            let deadline = Math.round((new Date()).getTime()/1000)+86400;
            await (await daiContract.connect(alice).mint(alice.address, amountADesired)).wait();
            await (await wethContract.connect(alice).deposit({value: amountBDesired})).wait();

            await (await daiContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait();
            await (await wethContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait();

            await (await uniswapV2Router.connect(alice).addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                to,
                deadline
            )).wait();

            let reserves = await uniswapV2Router.getReserves(tokenA, tokenB);

            expect(reserves[0]).to.be.eq(amountADesired);
            expect(reserves[1]).to.be.eq(amountBDesired);

        })

        it('add liquidity USDC/WETH', async () => {
            let tokenA = usdcContract.address;
            let tokenB = wethContract.address;
            let amountADesired = expandTo18DecimalsBN(10_000_000);
            let amountBDesired = expandTo18DecimalsBN(1_000_000);
            let amountAMin = amountADesired;
            let amountBMin = amountBDesired;
            let to = alice.address;
            let deadline = Math.round((new Date()).getTime()/1000)+86400;
            await (await usdcContract.connect(alice).mint(alice.address, amountADesired)).wait();
            await (await wethContract.connect(alice).deposit({value: amountBDesired})).wait();

            await (await usdcContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait();
            await (await wethContract.connect(alice).approve(uniswapV2Router.address, MAX_UINT)).wait();

            await (await uniswapV2Router.connect(alice).addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                to,
                deadline
            )).wait();

            let reserves = await uniswapV2Router.getReserves(tokenA, tokenB);

            expect(reserves[0]).to.be.eq(amountADesired);
            expect(reserves[1]).to.be.eq(amountBDesired);
        })

        it.skip('swap dai to weth', async () => {

            const amountInDAI = expandTo18DecimalsBN(100);

            let swapper = bob;
            let swapperAddress = bob.address;

            await daiContract.connect(swapper).approve(uniswapV2Router.address, MAX_UINT);
            await wethContract.connect(swapper).approve(uniswapV2Router.address, MAX_UINT);

            // let balanceOfDaiBefore = await daiContract.balanceOf(swapperAddress);
            // let balanceOfWethBefore = await wethContract.balanceOf(swapperAddress);
            // console.log("balance dai before: " + balanceOfDaiBefore);
            // console.log("balance weth before: " + balanceOfWethBefore);

            // function swapExactTokensForTokens(
            //     uint amountIn,
            //     uint amountOutMin,
            //     address[] calldata path,
            //     address to,
            //     uint deadline
            // )
          
            let amountIn = amountInDAI;
            let amountOutMin = 0;
            let path = [daiContract.address, wethContract.address];
            let to = swapperAddress;
            let deadlile = Math.round((new Date()).getTime()/1000)+86400;
            await (await uniswapV2Router.connect(bob).swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                to,
                deadlile
            )).wait();

            //await new Promise(f => setTimeout(f, 4000));

            //let balanceOfDaiAfter = await daiContract.balanceOf(swapperAddress);
            //let balanceOfWethAfter = await wethContract.balanceOf(swapperAddress);
            // console.log("balance dai after: " + balanceOfDaiAfter);
            // console.log("balance weth after: " + balanceOfWethAfter);
            
            //let reserves = await uniswapV2Router.getReserves(daiContract.address, wethContract.address);
            //console.log(reserves);

        })

        it.skip('pair for', async () => {
            let tokenA = daiContract.address;
            let tokenB = wethContract.address;
            let pair =  await uniswapV2Factory.getPair(tokenA, tokenB);
           
            let factoryAddress = await router.getUniswapV2Factory();
            // let initCodeHash = await uniswapV2Factory.INIT_CODE_HASH()

            let initCodeHash = await calculateInitCodeHash();
           
            let calculatedPair = await router.pairFor(factoryAddress, initCodeHash, tokenA, tokenB);
        
            console.log("pair on factory: " + pair);
            
            console.log("calculated Pair: " + calculatedPair);

            console.log("init code hash:  " + initCodeHash);

            // expect(pair).to.be.eq(calculatedPair)

        })
    })

    describe('Trade on Uniswap with Permit2, giving approval every time', () => {
        describe('ERC20 --> ERC20', () => {
            let permitSingle: PermitSingle;
            beforeEach(async () => {
              planner = new RoutePlanner();
            })
            
            it('V2 exactIn, permiting the exact amount', async () => {
                const amountInDAI = expandTo18DecimalsBN(100);
                const minAmountOutWETH = 0;

                // second bob signs a permitSingle to allow the router to access his DAI
                permitSingle = {
                    details: {
                      token: daiContract.address,
                      amount: amountInDAI,
                      expiration: 0, // expiration of 0 is block.timestamp
                      nonce: 0, // this is his first trade
                    },
                    spender: router.address,
                    sigDeadline: DEADLINE,
                };

                const signingKey: ethers.utils.SigningKey = new ethers.utils.SigningKey(BOB_PRIVATE_KEY);
                const sig = await getPermitSignature(permitSingle, signingKey, permit2);
                
                planner.addCommand(CommandType.PERMIT2_PERMIT, [permitSingle, sig]);
                planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
                    MSG_SENDER,
                    amountInDAI,
                    minAmountOutWETH,
                    [daiContract.address, wethContract.address],
                    SOURCE_MSG_SENDER,
                ]);
                
                const { wethBalanceBefore, wethBalanceAfter, daiBalanceAfter, daiBalanceBefore } = await executeRouter(planner);
                expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gte(minAmountOutWETH);
                expect(daiBalanceBefore.sub(daiBalanceAfter)).to.be.eq(amountInDAI);

            })

            it('V2 exactOut, permiting the maxAmountIn', async () => {
                const maxAmountInDAI = expandTo18DecimalsBN(3000);
                const amountOutWETH = expandTo18DecimalsBN(1);

                // second bob signs a permitSingle to allow the router to access his DAI
                permitSingle = {
                  details: {
                    token: daiContract.address,
                    amount: maxAmountInDAI,
                    expiration: 0, // expiration of 0 is block.timestamp
                    nonce: 0, // this is his first trade
                  },
                  spender: router.address,
                  sigDeadline: DEADLINE,
                };

                const signingKey: ethers.utils.SigningKey = new ethers.utils.SigningKey(BOB_PRIVATE_KEY);
                const sig = await getPermitSignature(permitSingle, signingKey, permit2);
        
                // 1) permitSingle the router to access funds, 2) trade - the transfer happens within the trade for exactOut
                planner.addCommand(CommandType.PERMIT2_PERMIT, [permitSingle, sig]);
                planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
                  MSG_SENDER,
                  amountOutWETH,
                  maxAmountInDAI,
                  [daiContract.address, wethContract.address],
                  SOURCE_MSG_SENDER,
                ]);
                const { wethBalanceBefore, wethBalanceAfter, daiBalanceAfter, daiBalanceBefore } = await executeRouter(planner);
                expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.eq(amountOutWETH);
                expect(daiBalanceBefore.sub(daiBalanceAfter)).to.be.lte(maxAmountInDAI);
            })

            it('V2 exactIn, swapping more than max_uint160 should revert', async () => {
                const max_uint = BigNumber.from(MAX_UINT160);
                const minAmountOutWETH = expandTo18DecimalsBN(0.03);
        
                // second bob signs a permitSingle to allow the router to access his DAI
                permitSingle = {
                  details: {
                    token: daiContract.address,
                    amount: max_uint,
                    expiration: 0, // expiration of 0 is block.timestamp
                    nonce: 0, // this is his first trade
                  },
                  spender: router.address,
                  sigDeadline: DEADLINE,
                };
                const signingKey: ethers.utils.SigningKey = new ethers.utils.SigningKey(BOB_PRIVATE_KEY);
                const sig = await getPermitSignature(permitSingle, signingKey, permit2);
        
                // 1) permitSingle the router to access funds, 2) withdraw the funds into the pair, 3) trade
                planner.addCommand(CommandType.PERMIT2_PERMIT, [permitSingle, sig]);
                planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
                  MSG_SENDER,
                  BigNumber.from(MAX_UINT160).add(1),
                  minAmountOutWETH,
                  [daiContract.address, wethContract.address],
                  SOURCE_MSG_SENDER,
                ]);
        
                await expect(executeRouter(planner)).to.be.reverted;
            })
        })
    })   

    describe('Trade on UniswapV2', () => {
        const amountIn: BigNumber = expandTo18DecimalsBN(5)
        beforeEach(async () => {
          // for these tests Bob gives the router max approval on permit2
          await (await permit2.approve(daiContract.address, router.address, MAX_UINT160, DEADLINE)).wait();
          await (await permit2.approve(wethContract.address, router.address, MAX_UINT160, DEADLINE)).wait();
          planner = new RoutePlanner();
        })

        describe('ERC20 --> ERC20', () => {
          it('completes a V2 exactIn swap', async () => {
            const minAmountOut = 0; //expandTo18DecimalsBN(0.0001)

            planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
              MSG_SENDER,
              amountIn,
              minAmountOut,
              [daiContract.address, wethContract.address],
              SOURCE_MSG_SENDER,
            ]);
            const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner);
            expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gt(minAmountOut);
          })

          it('completes a V2 exactOut swap', async () => {
            const amountOut = expandTo18DecimalsBN(1);
            
            planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
              MSG_SENDER,
              amountOut,
              expandTo18DecimalsBN(10000),
              [wethContract.address, daiContract.address],
              SOURCE_MSG_SENDER,
            ]);
            planner.addCommand(CommandType.SWEEP, [wethContract.address, MSG_SENDER, 0]);
            
            let daiBalanceBefore = await daiContract.balanceOf(bob.address);
            // console.log("DAI balance before: " + daiBalanceBefore)
            await executeRouter(planner);
            

            let daiBalanceAfter = await daiContract.balanceOf(bob.address);
            //console.log("DAI balance after: " + daiBalanceAfter)

            expect(daiBalanceAfter.sub(daiBalanceBefore)).to.be.gt(amountOut);
          })

          it('exactIn trade, where an output fee is taken', async () => {
            // back to the router so someone can take a fee

            planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
              router.address,
              amountIn,
              1,
              [daiContract.address, wethContract.address],
              SOURCE_MSG_SENDER,
            ]);
            planner.addCommand(CommandType.PAY_PORTION, [wethContract.address, alice.address, ONE_PERCENT_BIPS]);
            planner.addCommand(CommandType.SWEEP, [wethContract.address, MSG_SENDER, 1]);
    
            const { commands, inputs } = planner;
            const wethBalanceBeforeAlice = await wethContract.balanceOf(alice.address);
            const wethBalanceBeforeBob = await wethContract.balanceOf(bob.address);
    
            await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).wait();
            
            const wethBalanceAfterAlice = await wethContract.balanceOf(alice.address);
            const wethBalanceAfterBob = await wethContract.balanceOf(bob.address);
    
            const aliceFee = wethBalanceAfterAlice.sub(wethBalanceBeforeAlice);
            const bobEarnings = wethBalanceAfterBob.sub(wethBalanceBeforeBob);
    
            expect(aliceFee).to.be.gt(0);
            expect(bobEarnings).to.be.gt(0);
          })

          it('completes a V2 exactIn swap with longer path', async () => {
            const minAmountOut = expandTo18DecimalsBN(0.0001);

            planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
              MSG_SENDER,
              amountIn,
              minAmountOut,
              [daiContract.address, usdcContract.address, wethContract.address],
              SOURCE_MSG_SENDER,
            ]);
    
            const { wethBalanceBefore, wethBalanceAfter } = await executeRouter(planner);
            expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.gt(minAmountOut);
          })

        })

        describe('ERC20 --> ETH', () => {
            it('completes a V2 exactIn swap', async () => {
              const amountDaiIn = expandTo18DecimalsBN(1000);
              const minWethAmountOut = expandTo18DecimalsBN(0.0001);
               
              planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
                router.address,
                amountDaiIn,
                minWethAmountOut,
                [daiContract.address, wethContract.address],
                SOURCE_MSG_SENDER,
              ]);
              planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0]);
              
              const ethBalanceBefore = await provider.getBalance(bob.address);

              await executeRouter(planner);

              const ethBalanceAfter = await provider.getBalance(bob.address);

              expect(ethBalanceAfter.sub(ethBalanceBefore)).to.gt(0);
            })

            it('completes a V2 exactOut swap', async () => {
              const amountOut = expandTo18DecimalsBN(1)
              planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
                router.address,
                amountOut,
                expandTo18DecimalsBN(10000),
                [daiContract.address, wethContract.address],
                SOURCE_MSG_SENDER,
              ]);
              planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, amountOut]);
              planner.addCommand(CommandType.SWEEP, [daiContract.address, MSG_SENDER, 0]);
      
              await executeRouter(planner);
              
            })
      
            it('completes a V2 exactOut swap, with ETH fee', async () => {
              const amountOut = expandTo18DecimalsBN(1);

              planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
                router.address,
                amountOut,
                expandTo18DecimalsBN(10000),
                [daiContract.address, wethContract.address],
                SOURCE_MSG_SENDER,
              ]);
              planner.addCommand(CommandType.UNWRAP_WETH, [router.address, amountOut]);
              planner.addCommand(CommandType.PAY_PORTION, [ETH_ADDRESS, alice.address, ONE_PERCENT_BIPS]);
              planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, MSG_SENDER, 0]);
      
              const { commands, inputs } = planner;
              const ethBalanceBeforeAlice = await provider.getBalance(alice.address);
              const ethBalanceBeforeBob = await provider.getBalance(bob.address);
              const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).wait();
              
              const ethBalanceAfterAlice = await provider.getBalance(alice.address);
              const ethBalanceAfterBob = await provider.getBalance(bob.address);
              const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
              const aliceFee = ethBalanceAfterAlice.sub(ethBalanceBeforeAlice);
              const bobEarnings = ethBalanceAfterBob.sub(ethBalanceBeforeBob).add(gasSpent);
              
              expect(aliceFee).to.be.gt(0);
              expect(bobEarnings).to.be.gt(0);
            })
        })
       
        describe('ETH --> ERC20', () => {
            it('completes a V2 exactIn swap', async () => {
              const minAmountOut = expandTo18DecimalsBN(0.001);
              const pairAddress = await uniswapV2Factory.getPair(daiContract.address, wethContract.address);
          
              planner.addCommand(CommandType.WRAP_ETH, [pairAddress, amountIn]);

              // amountIn of 0 because the weth is already in the pair
              planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
                MSG_SENDER,
                0,
                minAmountOut,
                [wethContract.address, daiContract.address],
                SOURCE_MSG_SENDER,
              ]);
              const daiBalanceBefore = await daiContract.balanceOf(bob.address);

              await executeRouter(planner, amountIn);

              const daiBalanceAfter = await daiContract.balanceOf(bob.address);

              expect(daiBalanceAfter.sub(daiBalanceBefore)).to.be.gt(minAmountOut);
            })
      
            it('completes a V2 exactOut swap', async () => {
              const amountOut = expandTo18DecimalsBN(100);
              const value = expandTo18DecimalsBN(1.5);

              planner.addCommand(CommandType.WRAP_ETH, [router.address, value]);
              planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
                MSG_SENDER,
                amountOut,
                value,
                [wethContract.address, daiContract.address],
                SOURCE_ROUTER,
              ]);
              planner.addCommand(CommandType.UNWRAP_WETH, [MSG_SENDER, 0]);
                
              const daiBalanceBefore = await daiContract.balanceOf(bob.address);
              
              await executeRouter(planner, value);
            
              const daiBalanceAfter = await daiContract.balanceOf(bob.address);

              expect(daiBalanceAfter.sub(daiBalanceBefore)).gt(amountOut); // rounding

            })
        })



    })

    type V2SwapEventArgs = {
        amount0In: BigNumber;
        amount0Out: BigNumber;
        amount1In: BigNumber;
        amount1Out: BigNumber;
      }
    
    type V3SwapEventArgs = {
        amount0: BigNumber;
        amount1: BigNumber;
    }
    
    type ExecutionParams = {
        wethBalanceBefore: BigNumber;
        wethBalanceAfter: BigNumber;
        daiBalanceBefore: BigNumber;
        daiBalanceAfter: BigNumber;
        usdcBalanceBefore: BigNumber;
        usdcBalanceAfter: BigNumber;
        ethBalanceBefore: BigNumber;
        ethBalanceAfter: BigNumber;
        v2SwapEventArgs: V2SwapEventArgs | undefined;
        v3SwapEventArgs: V3SwapEventArgs | undefined;
        receipt: TransactionReceipt;
        gasSpent: BigNumber;
      }

    async function executeRouter(planner: RoutePlanner, value?: BigNumberish): Promise<ExecutionParams> {
        const ethBalanceBefore: BigNumber = await provider.getBalance(bob.address);
        const wethBalanceBefore: BigNumber = await wethContract.balanceOf(bob.address);
        const daiBalanceBefore: BigNumber = await daiContract.balanceOf(bob.address);
        const usdcBalanceBefore: BigNumber = await usdcContract.balanceOf(bob.address);
    
        const { commands, inputs } = planner;
    
        const receipt = await (await router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE, { value })).wait();
        const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        const v2SwapEventArgs = parseEvents(V2_EVENTS, receipt)[0]?.args as unknown as V2SwapEventArgs;
        const v3SwapEventArgs = parseEvents(V3_EVENTS, receipt)[0]?.args as unknown as V3SwapEventArgs;
    
        const ethBalanceAfter: BigNumber = await provider.getBalance(bob.address);
        const wethBalanceAfter: BigNumber = await wethContract.balanceOf(bob.address);
        const daiBalanceAfter: BigNumber = await daiContract.balanceOf(bob.address);
        const usdcBalanceAfter: BigNumber = await usdcContract.balanceOf(bob.address);
    
        return {
          wethBalanceBefore,
          wethBalanceAfter,
          daiBalanceBefore,
          daiBalanceAfter,
          usdcBalanceBefore,
          usdcBalanceAfter,
          ethBalanceBefore,
          ethBalanceAfter,
          v2SwapEventArgs,
          v3SwapEventArgs,
          receipt,
          gasSpent,
        };
      }
  
})
