// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import {ERC1155} from 'solmate/tokens/ERC1155.sol';
import {Permit2} from 'permit2/src/Permit2.sol';
import {UniswapV2Factory} from "../../lib/uniswapV2-zksync/contracts/UniswapV2Factory.sol";
import {UniswapV2Router02} from "../../lib/uniswapV2-zksync/contracts/UniswapV2Router02.sol";

// this contract only exists to pull ERC1155 and Permit2 into the hardhat build pipeline
// so that typechain artifacts are generated for it
abstract contract Imports is ERC1155, Permit2 {}
