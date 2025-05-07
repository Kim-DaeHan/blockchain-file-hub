// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract StringStorage {
    string private storedString;
    address public owner;

    event StringUpdated(string newValue);

    constructor() {
        owner = msg.sender;
        storedString = "Hello, World!"; // 기본값 설정
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can modify the string");
        _;
    }

    // 문자열 설정 함수
    function setString(string memory _newString) public onlyOwner {
        storedString = _newString;
        emit StringUpdated(_newString);
    }

    // 문자열 조회 함수
    function getString() public view returns (string memory) {
        return storedString;
    }
} 