
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import {ICryptoPunksMarket} from '../interfaces/external/ICryptoPunksMarket.sol';
import {ERC721} from 'solmate/tokens/ERC721.sol';


contract MockCryptopunks is ICryptoPunksMarket, ERC721 {
    address router;
    address alice;
    constructor( address _alice) ERC721('test', 'TEST') {
        alice = _alice;
    }

    function tokenURI(uint256 id) public view override returns (string memory){
        return '1';
    }

    function buyPunk(uint256 punkIndex) override external payable {
        _mint(alice, punkIndex);
    }

    function transferPunk(address to, uint256 punkIndex) override external {
        _mint(alice, punkIndex);
    }

    function punkIndexToAddress(uint256 punkIndex) external view returns(string memory alice) {
        return "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049";

    }
}
