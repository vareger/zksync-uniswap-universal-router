// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.6;

import { UniswapV3Factory } from "../../lib/v3-core/contracts/UniswapV3Factory.sol";
import { SwapRouter } from "../../lib/v3-periphery/contracts/SwapRouter.sol";
import { NonfungiblePositionManager } from "../../lib/v3-periphery/contracts/NonfungiblePositionManager.sol";
import { NonfungibleTokenPositionDescriptor } from "../../lib/v3-periphery/contracts/NonfungibleTokenPositionDescriptor.sol";