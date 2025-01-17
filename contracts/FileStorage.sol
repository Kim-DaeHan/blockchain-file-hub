// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract FileStorage is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    
    // 소유자별 토큰 ID 목록을 저장하는 매핑
    mapping(address => uint256[]) private _ownedTokens;

    // 파일 정보를 저장하는 이벤트
    event FileStored(uint256 indexed tokenId, address indexed owner);

    constructor() ERC721("FileStorageNFT", "FSNFT") Ownable(msg.sender) {}

    /**
     * @dev 새로운 파일 NFT를 발행합니다.
     */
    function safeMint(
        address to,
        string memory tokenURI
    ) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        _ownedTokens[to].push(tokenId);
        
        emit FileStored(tokenId, to);
        
        return tokenId;
    }

    /**
     * @dev 일반 사용자가 파일을 저장하고 NFT를 발행받습니다.
     */
    function storeFile(
        string memory tokenURI
    ) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);
        _ownedTokens[msg.sender].push(tokenId);
        
        emit FileStored(tokenId, msg.sender);
        
        return tokenId;
    }

    /**
     * @dev 토큰 ID로 파일 정보를 조회합니다.
     * @param tokenId 조회할 토큰의 ID
     * @return uri 파일의 URI
     * @return owner 토큰 소유자의 주소
     */
    function getFile(uint256 tokenId) public view returns (string memory uri, address owner) {
        owner = ownerOf(tokenId); // This will revert if token doesn't exist
        uri = tokenURI(tokenId);
        return (uri, owner);
    }

    /**
     * @dev 특정 주소가 소유한 모든 토큰 ID를 반환합니다.
     */
    function tokensOfOwner(address owner) public view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }


    /**
     * @dev 토큰을 소각합니다.
     */
    function burn(uint256 tokenId) public virtual {
        require(ownerOf(tokenId) == msg.sender, "ERC721: caller is not token owner");
        
        // 소유자의 토큰 목록에서 제거
        uint256[] storage tokens = _ownedTokens[msg.sender];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }
        
        _burn(tokenId);
    }

    /**
     * @dev 토큰을 전송합니다.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        super.transferFrom(from, to, tokenId);
        
        // 전송 후 소유자 목록 업데이트
        uint256[] storage fromTokens = _ownedTokens[from];
        for (uint256 i = 0; i < fromTokens.length; i++) {
            if (fromTokens[i] == tokenId) {
                fromTokens[i] = fromTokens[fromTokens.length - 1];
                fromTokens.pop();
                break;
            }
        }
        _ownedTokens[to].push(tokenId);
    }

    /**
     * @dev 토큰을 안전하게 전송합니다.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(ERC721, IERC721) {
        super.safeTransferFrom(from, to, tokenId, data);
        
        // 전송 후 소유자 목록 업데이트
        uint256[] storage fromTokens = _ownedTokens[from];
        for (uint256 i = 0; i < fromTokens.length; i++) {
            if (fromTokens[i] == tokenId) {
                fromTokens[i] = fromTokens[fromTokens.length - 1];
                fromTokens.pop();
                break;
            }
        }
        _ownedTokens[to].push(tokenId);
    }
} 