import { Provider, Contract, Wallet } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import * as hre from 'hardhat'
import {HttpNetworkConfig} from "hardhat/types";
import {ethers} from "ethers";
import {IN_MEMORY_NODE_RICH_WALLETS} from "./constants";

const RICH_WALLET_PRIVATE_KEYS = IN_MEMORY_NODE_RICH_WALLETS;

export const provider = new Provider((hre.network.config as HttpNetworkConfig).url)

const wallet = new Wallet(RICH_WALLET_PRIVATE_KEYS[0].privateKey, provider)
const deployer = new Deployer(hre, wallet)

export function getWallets(): Wallet[] {
    let wallets = []
    for (let i = 0; i < RICH_WALLET_PRIVATE_KEYS.length; i++) {
        wallets[i] = new Wallet(RICH_WALLET_PRIVATE_KEYS[i].privateKey, provider)
    }
    return wallets
}

export async function loadArtifact(name: string) {
    return await deployer.loadArtifact(name)
}

export async function deployContract(name: string, constructorArguments?: any[] | undefined): Promise<Contract> {
    const artifact = await loadArtifact(name)
    return await deployer.deploy(artifact, constructorArguments)
}

export async function walletDeployContract(deployerWallet:Wallet, name: string, constructorArguments?: any[] | undefined): Promise<Contract> {
    await (await wallet.transfer({to: deployerWallet.address, amount: ethers.utils.parseEther("1.0")})).wait()
    const artifact = await loadArtifact(name)
    let customDeployer = new Deployer(hre, deployerWallet)
    return await customDeployer.deploy(artifact, constructorArguments)
}
