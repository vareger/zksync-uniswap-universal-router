// import { UniversalRouter, Permit2, ERC20, MockLooksRareRewardsDistributor, ERC721 } from '../../typechain'
// import { BigNumberish } from 'ethers'
// import { Pair } from '@uniswap/v2-sdk'
// import { expect } from './shared/expect'
// import { abi as ROUTER_ABI } from '../../artifacts-zk/contracts/UniversalRouter.sol/UniversalRouter.json'
// import { abi as TOKEN_ABI } from '../../artifacts-zk/solmate/src/tokens/ERC20.sol/ERC20.json'
// import deployUniversalRouter, { deployPermit2 } from './shared/deployUniversalRouter'
// import {
//   DEADLINE,
//   ROUTER_REWARDS_DISTRIBUTOR,
//   SOURCE_MSG_SENDER,
//   MAX_UINT160,
//   MAX_UINT,
//   ETH_ADDRESS,
// } from './shared/constants'
// import { WETH, DAI } from './shared/mainnetForkHelpers'
// import { CommandType, RoutePlanner } from './shared/planner'
// import { makePair } from './shared/swapRouter02Helpers'
// import { expandTo18DecimalsBN } from './shared/helpers'
// import hre from 'hardhat'
// import {Wallet} from "zksync-web3";
// import {deployContract, getWallets} from "./shared/zkSyncUtils";
//
// const { ethers } = hre
// const routerInterface = new ethers.utils.Interface(ROUTER_ABI)
//
// describe('UniversalRouter', () => {
//   let alice: Wallet
//   let router: UniversalRouter
//   let permit2: Permit2
//   let daiContract: ERC20
//   let mockLooksRareToken: ERC20
//   let mockLooksRareRewardsDistributor: MockLooksRareRewardsDistributor
//   let pair_DAI_WETH: Pair
//
//   beforeEach(async () => {
//     alice = getWallets()[0]
//
//     // mock rewards contracts
//     mockLooksRareToken = (await deployContract('MintableERC20', [18, expandTo18DecimalsBN(5)])) as ERC20
//     mockLooksRareRewardsDistributor = (await deployContract('MockLooksRareRewardsDistributor', [
//         ROUTER_REWARDS_DISTRIBUTOR,
//         mockLooksRareToken.address
//     ])) as MockLooksRareRewardsDistributor
//     daiContract = new ethers.Contract(DAI.address, TOKEN_ABI, alice) as ERC20
//     pair_DAI_WETH = await makePair(alice, DAI, WETH)
//     permit2 = (await deployPermit2()).connect(alice) as Permit2
//     router = (
//         await deployUniversalRouter(permit2, mockLooksRareRewardsDistributor.address, mockLooksRareToken.address)
//     ).connect(alice) as UniversalRouter
//   })
//
//   describe('#execute', () => {
//     let planner: RoutePlanner
//
//     beforeEach(async () => {
//       planner = new RoutePlanner()
//       await daiContract.apwprove(permit2.address, MAX_UINT)
//       await permit2.approve(DAI.address, router.address, MAX_UINT160, DEADLINE)
//     })
//
//     it('reverts if block.timestamp exceeds the deadline', async () => {
//       planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
//         alice.address,
//         1,
//         1,
//         [DAI.address, WETH.address],
//         SOURCE_MSG_SENDER,
//       ])
//       const invalidDeadline = 10
//
//       const { commands, inputs } = planner
//
//       await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, invalidDeadline)).to.be.revertedWith(
//           'TransactionDeadlinePassed()'
//       )
//     })
//
//     it('reverts for an invalid command at index 0', async () => {
//       const commands = '0xff'
//       const inputs: string[] = ['0x12341234']
//
//       await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.be.revertedWith(
//           'InvalidCommandType(31)'
//       )
//     })
//
//     it('reverts for an invalid command at index 1', async () => {
//       const invalidCommand = 'ff'
//       planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
//         DAI.address,
//         pair_DAI_WETH.liquidityToken.address,
//         expandTo18DecimalsBN(1),
//       ])
//       let commands = planner.commands
//       let inputs = planner.inputs
//
//       commands = commands.concat(invalidCommand)
//       inputs.push('0x21341234')
//
//       await expect(router['execute(bytes,bytes[],uint256)'](commands, inputs, DEADLINE)).to.be.revertedWith(
//           'InvalidCommandType(31)'
//       )
//     })
//
//     it('reverts if paying a portion over 100% of contract balance', async () => {
//       await daiContract.transfer(router.address, expandTo18DecimalsBN(1))
//       planner.addCommand(CommandType.PAY_PORTION, [WETH.address, alice.address, 11_000])
//       planner.addCommand(CommandType.SWEEP, [WETH.address, alice.address, 1])
//       const { commands, inputs } = planner
//       await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWith('InvalidBips()')
//     })
//
//     it('reverts if a malicious contract tries to reenter', async () => {
//       const reentrantProtocol = await deployContract('ReenteringProtocol')
//
//       router = (
//           await deployUniversalRouter(
//               permit2,
//               mockLooksRareRewardsDistributor.address,
//               mockLooksRareToken.address,
//               reentrantProtocol.address
//           )
//       ).connect(alice) as UniversalRouter
//
//       planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, alice.address, 0])
//       let { commands, inputs } = planner
//
//       const sweepCalldata = routerInterface.encodeFunctionData('execute(bytes,bytes[])', [commands, inputs])
//       const reentrantCalldata = reentrantProtocol.interface.encodeFunctionData('callAndReenter', [
//         router.address,
//         sweepCalldata,
//       ])
//
//       planner = new RoutePlanner()
//       planner.addCommand(CommandType.NFTX, [0, reentrantCalldata])
//       ;({ commands, inputs } = planner)
//
//       const notAllowedReenterSelector = '0xb418cb98'
//       await expect(router['execute(bytes,bytes[])'](commands, inputs)).to.be.revertedWith(
//           `ExecutionFailed(0, "` + notAllowedReenterSelector + `")`
//       )
//     })
//   })
//
//   describe('#collectRewards', () => {
//     let amountRewards: BigNumberish
//     beforeEach(async () => {
//       amountRewards = expandTo18DecimalsBN(0.5)
//       await mockLooksRareToken.connect(alice).transfer(mockLooksRareRewardsDistributor.address, amountRewards)
//     })
//
//     it('transfers owed rewards into the distributor contract', async () => {
//       const balanceBefore = await mockLooksRareToken.balanceOf(ROUTER_REWARDS_DISTRIBUTOR)
//       await router.collectRewards('0x00')
//       const balanceAfter = await mockLooksRareToken.balanceOf(ROUTER_REWARDS_DISTRIBUTOR)
//       expect(balanceAfter.sub(balanceBefore)).to.eq(amountRewards)
//     })
//   })
// })
