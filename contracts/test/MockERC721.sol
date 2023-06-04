// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import {ERC721} from 'solmate/tokens/ERC721.sol';

contract MockERC721 is ERC721 {

    uint256 private _status;
    uint256 private constant _ENTERED = 2;
    uint256 private constant _NOT_ENTERED = 1;

    modifier nonReentrant() {
        // On the first call to nonReentrant, _notEntered will be true
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

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

    function buyAndRedeem(
    uint256 vaultId, 
    uint256 amount,
    uint256[] calldata specificIds, 
    address[] calldata path, 
    address to
  ) external payable  nonReentrant {
      mint(alice, 1);
      mint(alice, 2);
  }
}
