// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

contract MockFoundation {
    
    address payable alice;
    constructor(address payable receipent)  {
        alice = receipent;
    }

    function buyV2(address nftContract, uint256 tokenId, uint256 maxPrice, address payable referrer) public payable {
        uint256 fee = 10000000000000000000;
         (bool success,) = referrer.call{value: fee}("");

    }
}
