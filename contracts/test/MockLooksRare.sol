// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

import './libraries/OrderTypes.sol';

contract MockLooksRare {
    using OrderTypes for OrderTypes.MakerOrder;
    using OrderTypes for OrderTypes.TakerOrder;

    function matchAskWithTakerBidUsingETHAndWETH(
        OrderTypes.TakerOrder calldata takerBid,
        OrderTypes.MakerOrder calldata makerAsk
    ) external payable {}
}
