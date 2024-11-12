import { chainsConfig } from "@/constants/common";
import { ethers } from "ethers";

export const initialState = {
  chainId: "8453",
  platform: "wow",
  srcToken: "",
  destToken: "",
  amount: 0.01,
  fomartAmount: "0.01",
  slippage: 3,
  isBuyMode: true,
  platformWallet: "0x45C06f7aca34d031d799c446013aaa7A3E5F5D98",
  walletAddress: "",
  privateKey: "",
  useBrowserWallet: true,
  loading: false,
  transactionHash: "",
  errorMessage: "",
  balance: 0.01,
  wethBalance: "0",
  ethBalance: "0",
  purchasedTokens: [],
  symbolSuggestion: null,
  extraGasForMiner: true,
  ref: ethers.ZeroAddress,
  additionalGas: 0.1,
};

export const getProvider = (chainId) => {
  const rpcUrl = chainsConfig[chainId]?.rpcUrl;
  return new ethers.JsonRpcProvider(rpcUrl);
};

export const fetchAPI = async (url) => {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error fetching API:", error);
    return {};
  }
};

export const isValidPrivateKey = (key) => /^(0x)?[0-9a-fA-F]{64}$/.test(key);
