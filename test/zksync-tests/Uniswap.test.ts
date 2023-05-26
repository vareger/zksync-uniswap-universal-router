import { Permit2, UniversalRouter } from '../../typechain'
import {
    ALICE_PRIVATE_KEY,
    BOB_PRIVATE_KEY,
    MAX_UINT,
    DEADLINE,
    MSG_SENDER,
    SOURCE_MSG_SENDER,
} from './shared/constants'

import hre, { ethers } from 'hardhat'
// const { ethers } = hre
import { deployPermit2, deployRouter} from './shared/deployUniversalRouter'
import { Wallet, Provider, Contract } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import { expandTo18DecimalsBN } from './shared/helpers'
import { RoutePlanner, CommandType} from './shared/planner'
import { getPermitSignature, PermitSingle } from './shared/protocolHelpers/permit2'


/**
 * $ yarn hardhat test test/zksync-tests/Uniswap.test.ts --network zkSyncLocalhost
 */
describe('Uniswap V2 and V3 Tests:', () => {
    let provider: Provider
    let alice: Wallet
    let bob: Wallet
    let permit2: Permit2
    let router: UniversalRouter
    let wethContract: Contract
    let daiContract: Contract
    let usdcContract: Contract 
    let planner: RoutePlanner

    beforeEach(async () => {
        
        provider = Provider.getDefaultProvider()
        alice = new Wallet(ALICE_PRIVATE_KEY, provider)
        bob = new Wallet(BOB_PRIVATE_KEY, provider)
        let deployer = new Deployer(hre, alice)

        const MockERC20 = await deployer.loadArtifact("MockERC20")

        let weth = await deployer.deploy(MockERC20, [18])
        let dai = await deployer.deploy(MockERC20, [6])
        let usdc = await deployer.deploy(MockERC20, [6])
        wethContract = new Contract(weth.address, MockERC20.abi, alice)
        daiContract = new Contract(dai.address, MockERC20.abi, alice)
        usdcContract = new Contract(usdc.address, MockERC20.abi, alice)
        
        permit2 = await deployPermit2()
        router = await deployRouter(permit2)
        router
        planner = new RoutePlanner()

        await wethContract.connect(alice).mint(bob.address, '1000000000000000000000')
        await daiContract.connect(alice).mint(bob.address, '1000000000')
        await usdcContract.connect(alice).mint(bob.address, '1000000000')
        
        // await new Promise(f => setTimeout(f, 5000));
        // let balance = await daiContract.balanceOf(bob.address)
        // console.log(balance)

        await wethContract.connect(bob).approve(permit2.address, MAX_UINT)
        await daiContract.connect(bob).approve(permit2.address, MAX_UINT)
        await usdcContract.connect(bob).approve(permit2.address, MAX_UINT)

    
    })

    describe('Trade on Uniswap with Permit2, giving approval every time', () => {
        describe('ERC20 --> ERC20', () => {
            let permit: PermitSingle
            it('V2 exactIn, permiting the exact amount', async () => {
                const amountInDAI = expandTo18DecimalsBN(100)
                const minAmountOutWETH = expandTo18DecimalsBN(0.03)
                minAmountOutWETH
                // second bob signs a permit to allow the router to access his DAI
                permit = {
                    details: {
                    token: daiContract.address,
                    amount: amountInDAI,
                    expiration: 0, // expiration of 0 is block.timestamp
                    nonce: 0, // this is his first trade
                    },
                    spender: router.address,
                    sigDeadline: DEADLINE,
                }
                // bobSignerWithAddress = await ethers.getSigner(bob.address)
                // const sig = await getPermitSignature(permit, bobSignerWithAddress, permit2)

                // // 1) permit the router to access funds, 2) withdraw the funds into the pair, 3) trade
                // planner.addCommand(CommandType.PERMIT2_PERMIT, [permit, sig])
                // planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
                //     MSG_SENDER,
                //     amountInDAI,
                //     minAmountOutWETH,
                //     [daiContract.address, wethContract.address],
                //     SOURCE_MSG_SENDER,
                // ])
            })
        })
    })   


  
})
