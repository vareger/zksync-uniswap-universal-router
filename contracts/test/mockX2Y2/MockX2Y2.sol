// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.15;

// https://etherscan.io/address/0x6d7812d41a08bc2a910b562d8b56411964a4ed88#code
contract MockX2Y2 {

   struct OrderItem {
        uint256 price;
        bytes data;
   }

    struct Order {
        uint256 salt;
        address user;
        uint256 network;
        uint256 intent;
        uint256 delegateType;
        uint256 deadline;
        address currency;
        bytes dataMask;
        OrderItem[] items;
        // signature
        bytes32 r;
        bytes32 s;
        uint8 v;
        uint8 signVersion;
    }

    struct Fee {
        uint256 percentage;
        address to;
    }

    struct SettleDetail {
        Op op;
        uint256 orderIdx;
        uint256 itemIdx;
        uint256 price;
        bytes32 itemHash;
        address executionDelegate;
        bytes dataReplacement;
        uint256 bidIncentivePct;
        uint256 aucMinIncrementPct;
        uint256 aucIncDurationSecs;
        Fee[] fees;
    }

    struct SettleShared {
        uint256 salt;
        uint256 deadline;
        uint256 amountToEth;
        uint256 amountToWeth;
        address user;
        bool canFail;
    }

    struct RunInput {
        Order[] orders;
        SettleDetail[] details;
        SettleShared shared;
        // signature
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

    struct OngoingAuction {
        uint256 price;
        uint256 netPrice;
        uint256 endAt;
        address bidder;
    }

    enum InvStatus {
        NEW,
        AUCTION,
        COMPLETE,
        CANCELLED,
        REFUNDED
    }

    enum Op {
        INVALID,
        // off-chain
        COMPLETE_SELL_OFFER,
        COMPLETE_BUY_OFFER,
        CANCEL_OFFER,
        // auction
        BID,
        COMPLETE_AUCTION,
        REFUND_AUCTION,
        REFUND_AUCTION_STUCK_ITEM
    }

    enum DelegationType {
        INVALID,
        ERC721,
        ERC1155
    }

   function run(RunInput memory input) public payable {
        
   }
}