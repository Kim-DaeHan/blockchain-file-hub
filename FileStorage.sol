// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FileStorage {
    struct FileInfo {
        string fileName;
        address owner;
        uint256 timestamp;
    }
    
    mapping(string => FileInfo) private files; // ipfsHash => FileInfo
    mapping(address => string[]) private userFiles; // user address => ipfsHashes
    
    event FileStored(string ipfsHash, string fileName, address owner);
    
    function storeFile(string memory ipfsHash, string memory fileName) public {
        require(bytes(files[ipfsHash].fileName).length == 0, "File already exists");
        
        files[ipfsHash] = FileInfo({
            fileName: fileName,
            owner: msg.sender,
            timestamp: block.timestamp
        });
        userFiles[msg.sender].push(ipfsHash);
        emit FileStored(ipfsHash, fileName, msg.sender);
    }
    
    function getFileInfo(string memory ipfsHash) public view returns (FileInfo memory) {
        return files[ipfsHash];
    }
    
    function getUserFiles() public view returns (string[] memory) {
        return userFiles[msg.sender];
    }
} 