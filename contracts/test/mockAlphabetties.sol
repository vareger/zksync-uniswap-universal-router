// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import {ERC721} from 'solmate/tokens/ERC721.sol';

contract MockAlphabetties is ERC721 {


    address alice;
    constructor(address receipent) ERC721('test', 'TEST') {
        alice = receipent;
    }

     function tokenURI(uint256 id) public view override returns (string memory){
        return '1';
    }

    function mint(address to, uint256 id) public {
        _mint(to, id);
    }

    function ethForNft(address _nft, uint256[] memory _toIds, uint256[] memory _toAmounts, address _receipient, uint24 _fee, bool isV3) payable public {
        _mint(alice, 129);
        _mint(alice, 193);
        _mint(alice, 278);
    }

   
}
