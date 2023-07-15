// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import './MockNFTX_Coven_Vault.sol';
import './MockNFTX_ERC_1155_Vault.sol';
import '../MockERC721.sol';
import '../MockERC1155.sol';

contract MockNFTX_ZAP {
    MockNFTX_Coven_Vault public covenVault;
    MockNFTX_ERC_1155_Vault public erc1155Vault;

    uint256 public totalSupplyNFT;
    uint256 public totalSupplyERC1155;

    constructor(address _covenVault, address _erc1155Vault) {
        covenVault = MockNFTX_Coven_Vault(_covenVault);
        erc1155Vault = MockNFTX_ERC_1155_Vault(_erc1155Vault);
    }

    function buyAndRedeem(
        uint256 vaultId,
        uint256 amount,
        uint256[] calldata specificIds,
        address[] calldata path,
        address to
    ) external payable {
        if (vaultId == 333) {
            if (specificIds.length > 0) {
                if (MockERC721(covenVault.coven()).ownerOf(specificIds[0]) == to) {
                    return;
                }
                for (uint256 i = 0; i < specificIds.length; i++) {
                    MockERC721(covenVault.coven()).mint(to, specificIds[i]);
                }
                return;
            }
            if (amount > 0) {
                for (uint256 i = 0; i < amount; i++) {
                    MockERC721(covenVault.coven()).mint(to, totalSupplyNFT);
                    totalSupplyNFT++;
                }
                return;
            }
        }
        if (vaultId == 61) {
            if (specificIds.length > 0) {
                for (uint256 i = 0; i < specificIds.length; i++) {
                    MockERC1155(erc1155Vault.erc1155()).mint(to, specificIds[i], amount);
                }
                return;
            }
            if (amount > 0) {
                for (uint256 i = 0; i < amount; i++) {
                    MockERC1155(erc1155Vault.erc1155()).mint(to, totalSupplyERC1155, 1);
                    totalSupplyERC1155++;
                }
                return;
            }
        }
    }
}
