// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import {ERC1155} from 'solmate/tokens/ERC1155.sol';

contract MockERC1155 is ERC1155 {
    
    constructor() public ERC1155() {
        
    }
    function mint(address to, uint256 id, uint256 amount) public {
        balanceOf[to][id] += amount;
    }

    function uri(uint256 id) public view override returns (string memory){
        return '1';
    }

    function balanceOfUser(address owner, uint256 id) public view returns (uint256){
        return  balanceOf[owner][id];
    }
}
