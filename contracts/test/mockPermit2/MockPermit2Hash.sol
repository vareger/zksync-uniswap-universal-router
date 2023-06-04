// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract MockPermit2Hash {
   
    bytes32 public constant _PERMIT_SINGLE_TYPEHASH = keccak256("PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");
    bytes32 public constant _PERMIT_DETAILS_TYPEHASH = keccak256("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");


    bytes32 public immutable _CACHED_DOMAIN_SEPARATOR;
    uint256 public immutable _CACHED_CHAIN_ID;

    bytes32 public constant _HASHED_NAME = keccak256("Permit2");
    bytes32 public constant _TYPE_HASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    address public permit2;
    
    constructor(address _permit2) {
        permit2 = _permit2;
        _CACHED_CHAIN_ID = block.chainid;
        _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator(_TYPE_HASH, _HASHED_NAME);
    }    

    struct PermitDetails {
        // ERC20 token address
        address token;
        // the maximum amount allowed to spend
        uint160 amount;
        // timestamp at which a spender's token allowances become invalid
        uint48 expiration;
        // an incrementing value indexed per owner,token,and spender for each signature
        uint48 nonce;
    }

    struct PermitSingle {
        // the permit data for a single token alownce
        PermitDetails details;
        // address permissioned on the allowed tokens
        address spender;
        // deadline on the permit signature
        uint256 sigDeadline;
    }

    /// @notice Builds a domain separator using the current chainId and contract address.
    function _buildDomainSeparator(bytes32 typeHash, bytes32 nameHash) private view returns (bytes32) {
        return keccak256(abi.encode(typeHash, nameHash, block.chainid, permit2));
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == _CACHED_CHAIN_ID
            ? _CACHED_DOMAIN_SEPARATOR
            : _buildDomainSeparator(_TYPE_HASH, _HASHED_NAME);
    }

    function hashPermitDetails(PermitDetails memory details) public pure returns (bytes32) {
        return keccak256(abi.encode(_PERMIT_DETAILS_TYPEHASH, details));
    }

    function hashPerimitSingle(PermitSingle memory permitSingle) public pure returns (bytes32) {
        bytes32 permitDetailsHash = hashPermitDetails(permitSingle.details);
        return keccak256(abi.encode(_PERMIT_SINGLE_TYPEHASH, permitDetailsHash, permitSingle.spender, permitSingle.sigDeadline));
    }

    /// @notice Creates an EIP-712 typed data hash
    function _hashTypedData(bytes32 dataHash) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), dataHash));
    }

    function hash(PermitSingle memory permitSingle) public view returns (bytes32) {
        return _hashTypedData(hashPerimitSingle(permitSingle));
    }

}