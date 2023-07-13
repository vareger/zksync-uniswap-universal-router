// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import {ERC1155} from "solmate/src/tokens/ERC1155.sol";

contract MockLooksRare1155 is ERC1155 {

    address public alice;

    constructor(address _alice) {
        alice = _alice;
    }
    function uri(uint256 tokenId) public override view returns (string memory) {
        alice; tokenId;
        return '1';
    }

    function mint(address to, uint256 tokenId, uint256 amount) public {
        _mint(to, tokenId, amount, "");
    }

}