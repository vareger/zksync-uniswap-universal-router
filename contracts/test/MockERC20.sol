// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import {ERC20} from 'solmate/src/tokens/ERC20.sol';

contract MockERC20 is ERC20 {
    constructor(uint8 decimals) ERC20('test', 'TEST', decimals) {
    }

    function mint(address to, uint256 amount) public {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}
