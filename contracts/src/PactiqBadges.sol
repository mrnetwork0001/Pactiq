// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PactiqBadges
 * @notice Soulbound (ERC-5192) ERC-721 streak badges, minted by PactiqVault when a user reaches a
 *         7, 30 or 100-day verified streak. Badges cannot be transferred or approved.
 * @dev Minimal ERC-721 written in-house (OZ ERC721 pulls in Cancun-only opcodes; QIE is Shanghai).
 */
contract PactiqBadges is Ownable {
    string public constant name = "Pactiq Discipline Badge";
    string public constant symbol = "PACTIQ";

    uint8 public constant TIER_COUNT = 3;
    uint256[3] public TIER_DAYS = [uint256(7), 30, 100];

    address public minter;
    string public baseURI;
    uint256 public totalSupply;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => uint8) public tierOf;
    mapping(address => mapping(uint8 => uint256)) public badgeOf; // user => tier => tokenId (0 = none)

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Locked(uint256 tokenId); // ERC-5192
    event MinterUpdated(address minter);
    event BaseURIUpdated(string baseURI);

    error Soulbound();
    error NotMinter();
    error InvalidTier();
    error AlreadyHasBadge();
    error NonexistentToken();
    error ZeroAddress();

    constructor(string memory _baseURI) Ownable(msg.sender) {
        baseURI = _baseURI;
    }

    // --- minting ---

    function mint(address to, uint8 tier) external returns (uint256 tokenId) {
        if (msg.sender != minter) revert NotMinter();
        if (to == address(0)) revert ZeroAddress();
        if (tier >= TIER_COUNT) revert InvalidTier();
        if (badgeOf[to][tier] != 0) revert AlreadyHasBadge();

        tokenId = ++totalSupply;
        _owners[tokenId] = to;
        _balances[to]++;
        tierOf[tokenId] = tier;
        badgeOf[to][tier] = tokenId;

        emit Transfer(address(0), to, tokenId);
        emit Locked(tokenId);
    }

    // --- ERC-721 views ---

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert ZeroAddress();
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NonexistentToken();
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        return string.concat(baseURI, _toString(tokenId));
    }

    /// @notice ERC-5192: every Pactiq badge is permanently locked to its owner.
    function locked(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId);
        return true;
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 // ERC-165
            || id == 0x80ac58cd // ERC-721
            || id == 0x5b5e139f // ERC-721 Metadata
            || id == 0xb45a3c0e; // ERC-5192
    }

    // --- transfers are disabled ---

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    // --- admin ---

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
        emit MinterUpdated(_minter);
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 digits;
        for (uint256 v = value; v != 0; v /= 10) {
            digits++;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            buffer[--digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
