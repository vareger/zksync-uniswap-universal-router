// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

contract MockFoundation {
    
    address public alice;
    constructor(address payable receipent)  {
        alice = receipent;
    }

    function buyV2(address nftContract, uint256 tokenId, uint256 maxPrice, address payable referrer) public payable {
        nftContract; tokenId; maxPrice;
        uint256 fee = 10000000000000000000;
        (bool success,) = referrer.call{value: fee}("");
        success;
    }
}
