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

// 메타데이터 생성 함수
async function createMetadata(fileName, fileSize, fileType, ipfsHash) {
  return {
    name: fileName,
    description: `File stored in blockchain-file-hub`,
    image: `ipfs://${ipfsHash}`,
    attributes: [
      {
        trait_type: "File Type",
        value: fileType,
      },
      {
        trait_type: "File Size",
        value: fileSize,
      },
      {
        trait_type: "Upload Date",
        value: new Date().toISOString(),
      },
    ],
  };
}

// 메타데이터를 IPFS에 업로드하는 함수
async function uploadMetadataToIPFS(metadata) {
  try {
    const result = await pinata.pinJSONToIPFS(metadata);
    return result.IpfsHash;
  } catch (error) {
    console.error("메타데이터 업로드 오류:", error);
    throw new Error("메타데이터 IPFS 업로드 중 오류가 발생했습니다.");
  }
}

// 메타데이터를 가져오는 함수
async function fetchMetadata(tokenURI) {
  try {
    const url = tokenURI.replace("ipfs://", IPFS_GATEWAY);
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("메타데이터 가져오기 실패:", error);
    throw new Error("메타데이터를 가져오는데 실패했습니다.");
  }
}

// 파일 업로드 API 엔드포인트
app.post("/upload-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
    }

    const filePath = req.file.path;

    // 1. 실제 파일을 IPFS에 업로드
    const fileIpfsHash = await uploadToIPFS(filePath);
    console.log("File IPFS Hash:", fileIpfsHash);

    // 2. 메타데이터 생성
    const metadata = await createMetadata(
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      fileIpfsHash
    );

    // 3. 메타데이터를 IPFS에 업로드
    const metadataIpfsHash = await uploadMetadataToIPFS(metadata);
    console.log("Metadata IPFS Hash:", metadataIpfsHash);

    // 4. NFT 발행 (메타데이터 URI를 사용)
    const tokenURI = `ipfs://${metadataIpfsHash}`;
    const tx = await contract.storeFile(tokenURI);
    const receipt = await tx.wait();

    // 토큰 ID 가져오기 (이벤트에서)
    const event = receipt.logs.find(
      (log) => contract.interface.parseLog(log)?.name === "FileStored"
    );
    const tokenId = event
      ? contract.interface.parseLog(event).args.tokenId
      : null;

    // 임시 파일 삭제
    fs.unlinkSync(filePath);

    res.json({
      fileName: req.file.originalname,
      fileIpfsHash: fileIpfsHash,
      metadataIpfsHash: metadataIpfsHash,
      tokenId: tokenId.toString(),
      transactionHash: tx.hash,
      tokenURI: tokenURI,
      fileUrl: `${IPFS_GATEWAY}${fileIpfsHash}`,
      metadataUrl: `${IPFS_GATEWAY}${metadataIpfsHash}`,
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
app.get("/files/:tokenId", async (req, res) => {
  try {
    const tokenId = req.params.tokenId;

    // 스마트 컨트랙트에서 파일 정보 조회
    const [uri, owner] = await contract.getFile(tokenId);

    // 메타데이터 가져오기
    const metadata = await fetchMetadata(uri);

    // 실제 파일의 IPFS 해시 추출
    const fileIpfsHash = metadata.image.replace("ipfs://", "");

    res.json({
      tokenId: tokenId,
      name: metadata.name,
      description: metadata.description,
      fileUrl: `${IPFS_GATEWAY}${fileIpfsHash}`,
      metadataUrl: uri.replace("ipfs://", IPFS_GATEWAY),
      owner: owner,
      attributes: metadata.attributes,
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
