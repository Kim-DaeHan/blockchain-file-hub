require("dotenv").config();
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { abi: contractABI } = require("./contracts/FileStorage.json");
const axios = require("axios");
const pinataSDK = require("@pinata/sdk");

const app = express();
const upload = multer({ dest: "uploads/" });

// Pinata 설정
const pinata = new pinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_API_SECRET
);
const IPFS_GATEWAY = process.env.IPFS_GATEWAY_URL;

// Sepolia 네트워크 설정
const SEPOLIA_RPC_URL = `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractABI,
  wallet
);

// 파일 해시 생성 함수
function generateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", (err) => reject(err));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

// 파일을 IPFS에 업로드하는 함수
async function uploadToIPFS(filePath) {
  const readableStreamForFile = fs.createReadStream(filePath);
  const options = {
    pinataMetadata: {
      name: path.basename(filePath),
    },
  };

  try {
    const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
    return result.IpfsHash;
  } catch (error) {
    console.error("Pinata 업로드 오류:", error);
    throw new Error("IPFS 업로드 중 오류가 발생했습니다.");
  }
}

// IPFS에서 파일 다운로드하는 함수
async function downloadFromIPFS(ipfsHash) {
  try {
    const response = await axios({
      method: "get",
      url: `${IPFS_GATEWAY}${ipfsHash}`,
      responseType: "arraybuffer",
    });
    return response.data;
  } catch (error) {
    console.error("IPFS 다운로드 오류:", error);
    throw new Error("IPFS에서 파일 다운로드 중 오류가 발생했습니다.");
  }
}

// 파일 업로드 API 엔드포인트
app.post("/upload-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
    }

    const filePath = req.file.path;
    console.log("req.file: ", req.file);
    const fileHash = await generateFileHash(filePath);

    // IPFS에 파일 업로드
    const ipfsHash = await uploadToIPFS(filePath);
    console.log("ipfsHash: ", ipfsHash);

    // 스마트 컨트랙트에 파일 정보 저장
    const tx = await contract.storeFile(ipfsHash, req.file.originalname);
    await tx.wait();

    // 임시 파일 삭제
    fs.unlinkSync(filePath);

    res.json({
      fileName: req.file.originalname,
      fileHash: fileHash,
      ipfsHash: ipfsHash,
      transactionHash: tx.hash,
      algorithm: "SHA-256",
      ipfsUrl: `${IPFS_GATEWAY}${ipfsHash}`,
    });
  } catch (error) {
    console.error("파일 처리 중 오류 발생:", error);
    res.status(500).json({ error: "파일 처리 중 오류가 발생했습니다." });
  }
});

// 파일 다운로드 API 엔드포인트
app.get("/download-file/:ipfsHash", async (req, res) => {
  try {
    const ipfsHash = req.params.ipfsHash;

    // 스마트 컨트랙트에서 파일 정보 조회
    const fileInfo = await contract.getFileInfo(ipfsHash);

    if (!fileInfo.fileName) {
      return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
    }

    // IPFS에서 파일 다운로드
    const fileData = await downloadFromIPFS(ipfsHash);
    const encodedFilename = encodeURIComponent(fileInfo.fileName);

    // 파일 다운로드 응답 설정
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    // 파일 데이터 전송
    res.send(fileData);
  } catch (error) {
    console.error("파일 다운로드 중 오류 발생:", error);
    res.status(500).json({ error: "파일 다운로드 중 오류가 발생했습니다." });
  }
});

// 파일 정보 조회 API 엔드포인트
app.get("/files/:ipfsHash", async (req, res) => {
  try {
    const ipfsHash = req.params.ipfsHash;

    // 스마트 컨트랙트에서 파일 정보 조회
    const fileInfo = await contract.getFileInfo(ipfsHash);

    if (!fileInfo.fileName) {
      return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
    }

    res.json({
      ipfsHash: ipfsHash,
      fileName: fileInfo.fileName,
      owner: fileInfo.owner,
      timestamp: new Date(Number(fileInfo.timestamp) * 1000).toISOString(),
      ipfsUrl: `${IPFS_GATEWAY}${ipfsHash}`,
    });
  } catch (error) {
    console.error("파일 정보 조회 중 오류 발생:", error);
    res.status(500).json({ error: "파일 정보 조회 중 오류가 발생했습니다." });
  }
});

// 사용자의 파일 목록 조회 API 엔드포인트
app.get("/my-files", async (req, res) => {
  try {
    const ipfsHashes = await contract.getUserFiles();
    const files = await Promise.all(
      ipfsHashes.map(async (ipfsHash) => {
        const fileInfo = await contract.getFileInfo(ipfsHash);
        return {
          ipfsHash: ipfsHash,
          fileName: fileInfo.fileName,
          timestamp: new Date(Number(fileInfo.timestamp) * 1000).toISOString(),
          ipfsUrl: `${IPFS_GATEWAY}${ipfsHash}`,
        };
      })
    );

    res.json(files);
  } catch (error) {
    console.error("파일 목록 조회 중 오류 발생:", error);
    res.status(500).json({ error: "파일 목록 조회 중 오류가 발생했습니다." });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
