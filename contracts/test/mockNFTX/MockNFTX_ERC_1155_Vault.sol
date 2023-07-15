// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

contract MockNFTX_ERC_1155_Vault {
    address public erc1155;

    constructor(address _erc1155) {
        erc1155 = _erc1155;
    }
}
