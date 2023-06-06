// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import {ERC721} from 'solmate/tokens/ERC721.sol';

contract MockCryptoCovens is ERC721 {

    address public alice;

    constructor(address _alice) ERC721('MockCryptoCovens', 'MCRCONVC') {
        alice = _alice;
    }

    function tokenURI(uint256 id) public view override returns (string memory){
        return '1';
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
       return _ownerOf[tokenId];        
    }

    function mint(address to, uint256 id) public {
        _mint(to, id);
    }

    
}