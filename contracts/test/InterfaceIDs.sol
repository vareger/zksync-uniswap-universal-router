// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC721Receiver} from 'openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol';
import {IERC1155Receiver} from 'openzeppelin-contracts/contracts/token/ERC1155/IERC1155Receiver.sol';
import {IERC165} from 'openzeppelin-contracts/contracts/utils/introspection/IERC165.sol';

/// @title ERC Callback Support
/// @notice Implements various functions introduced by a variety of ERCs for security reasons.
/// All are called by external contracts to ensure that this contract safely supports the ERC in question.
contract InterfaceIDs{
    

    function getIERC165InterfaceId() external pure returns (bytes4){
        return type(IERC165).interfaceId;
    }

    function getIERC1155InterfaceId() external pure returns (bytes4){
        return type(IERC1155Receiver).interfaceId;
    }

    function getIERC721InterfaceId() external pure returns (bytes4){
        return type(IERC721Receiver).interfaceId;
    }
}
