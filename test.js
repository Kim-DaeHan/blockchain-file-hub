const { ethers } = require("ethers");
const contractABI = require("./contracts/StringStorage.abi.json");

async function main() {
  try {
    // Provider 설정 (로컬 또는 테스트넷/메인넷)
    const provider = new ethers.JsonRpcProvider("http://localhost:8551"); // 적절한 RPC URL로 변경하세요

    // 컨트랙트 주소
    const contractAddress = "0x6F234536e5f39b8Aa9551B8D71D4dC43aBea2F8E";

    // 컨트랙트 인스턴스 생성
    const contract = new ethers.Contract(
      contractAddress,
      contractABI.abi,
      provider
    );

    // getString 함수 호출
    const result = await contract.getString();
    console.log("저장된 문자열:", result);
  } catch (error) {
    console.error("에러 발생:", error);
  }
}

main();
