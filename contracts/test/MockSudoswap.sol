// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import {ERC721} from 'solmate/src/tokens/ERC721.sol';
import {LSSVMPair} from './LSSVMPair.sol';

contract MockSudoswap is ERC721 {


    address public alice;
    struct PairSwapSpecific {
        LSSVMPair pair;
        uint256[] nftIds;
    }
    struct RobustPairSwapSpecific {
        PairSwapSpecific swapInfo;
        uint256 maxCost;
    }
    constructor(address receipent) ERC721('test', 'TEST') {
        alice = receipent;
    }

    function tokenURI(uint256 id) public view override returns (string memory){
        alice; id;
        return '1';
    }

    function mint(address to, uint256 id) public {
        _mint(to, id);
    }

    function robustSwapETHForSpecificNFTs(RobustPairSwapSpecific[] memory swapList, address payable ethRecipient, address nftRecipient, uint256 deadline) payable public returns (uint256 remainingValue) {
        swapList; ethRecipient; nftRecipient; deadline;
        remainingValue;
        _mint(alice, 80);
        _mint(alice, 35);
        _mint(alice, 93);
    }

   
}
