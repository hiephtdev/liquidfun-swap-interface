import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { chainsConfig } from "@/constants/common";

export default function LiquidFunPlatform({
  isBuyMode,
  wallet,
  amount,
  platformWallet,
  srcToken,
  destToken,
  chainId,
  slippage,
  handleTransactionComplete,
  loadBalance,
  addTokenToStorage,
  removeTokenFromStorage,
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [displayAmount, setDisplayAmount] = useState("0");
  const [loading, setLoading] = useState(false);

  // Retrieves the wallet and switches chains if necessary
  const getWallet = async () => {
    try {
      let currentWallet = wallet;
      if (useBrowserWallet) {
        if (wallet.chainId !== `eip155:${chainId}`) {
          await wallet.switchChain(parseInt(chainId));
        }
        const ethereumProvider = await wallet.getEthereumProvider();
        const provider = new ethers.BrowserProvider(ethereumProvider);
        currentWallet = await provider.getSigner();
      }
      return currentWallet;
    } catch (error) {
      console.error("Error switching network:", error);
    }
    return null;
  };

  // Fetches the price with slippage to display for the user
  const fetchPrice = async () => {
    try {
      setErrorMessage("");
      handleTransactionComplete("");
      if (!destToken || !srcToken) return;

      const queryParam = isBuyMode ? "destAmount" : "srcAmount";
      const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${chainId}&src=${srcToken}&dest=${destToken}&${queryParam}=${amount}`;
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}` },
      });

      if (!response.ok) throw new Error(`API Error: ${await response.text()}`);

      const responseData = await response.json();
      const { amount: apiAmount } = responseData.rates[0];

      // Apply slippage to the fetched amount for display
      const slippageAdjustedAmount = isBuyMode
        ? BigInt(apiAmount) * BigInt(100 + slippage) / 100n
        : BigInt(apiAmount) * BigInt(100 - slippage) / 100n;

      setDisplayAmount(slippageAdjustedAmount.toString());
    } catch (error) {
      console.error("Error updating display price:", error);
      setErrorMessage("Error updating display price.");
    }
  };

  // Updates the displayed price whenever buy/sell mode, amount, source, or destination tokens, or slippage changes
  useEffect(() => {
    fetchPrice();
  }, [isBuyMode, amount, srcToken, destToken, slippage]);

  // Executes a buy transaction with slippage adjustment
  const handleBuy = async () => {
    try {
      setErrorMessage("");
      handleTransactionComplete("");
      if (!srcToken || !destToken) {
        setErrorMessage("Invalid token addresses.");
        return;
      }
      if (!amount || amount === "0") {
        setErrorMessage("Invalid amount.");
        return;
      }

      setLoading(true);
      const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${chainId}&src=${srcToken}&dest=${destToken}&destAmount=${amount}`;
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}` },
      });

      if (!response.ok) throw new Error(`API Error: ${await response.text()}`);

      const { data, amount: apiAmount } = await response.json();

      // Apply slippage to the transaction amount
      const slippageAdjustedAmount = BigInt(apiAmount) * BigInt(100 + slippage) / 100n;
      addTokenToStorage(destToken);

      const currentWallet = await getWallet();
      const tx = await currentWallet.sendTransaction({
        to: platformWallet,
        data: data,
        value: ethers.parseEther(slippageAdjustedAmount.toString()), // Send adjusted amount with slippage
      });

      await tx.wait();
      handleTransactionComplete(tx.hash);
      loadBalance(currentWallet.address);
    } catch (error) {
      console.error("Error executing buy transaction on LiquidFun:", error);
      setErrorMessage(`Error executing buy transaction on LiquidFun: ${error.message ?? error}`);
    } finally {
      setLoading(false);
    }
  };

  // Executes a sell transaction with zero ETH value sent
  const handleSell = async () => {
    try {
      setErrorMessage("");
      handleTransactionComplete("");
      if (!srcToken || !destToken) {
        setErrorMessage("Invalid token addresses.");
        return;
      }
      if (!amount || amount === "0") {
        setErrorMessage("Invalid amount.");
        return;
      }
      setLoading(true);

      const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${chainId}&src=${srcToken}&dest=${destToken}&srcAmount=${amount}`;
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}` },
      });

      if (!response.ok) throw new Error(`API Error: ${await response.text()}`);

      const { data } = await response.json();
      const currentWallet = await getWallet();
      const tx = await currentWallet.sendTransaction({
        to: platformWallet,
        data: data,
        value: 0, // Sell transactions do not require ETH
      });

      await tx.wait();
      handleTransactionComplete(tx.hash);
      loadBalance(currentWallet.address);
    } catch (error) {
      console.error("Error executing sell transaction on LiquidFun:", error);
      setErrorMessage(`Error executing sell transaction on LiquidFun: ${error.message ?? error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 text-center">
        {isBuyMode
          ? `Amount to pay (with slippage): ${ethers.formatUnits(displayAmount, 18)} ${srcToken === chainsConfig[chainId]?.tokens.WETH ? "ETH" : srcToken === chainsConfig[chainId]?.tokens.USDC ? "USDC" : "USDT"
          }`
          : `Amount to receive (with slippage): ${ethers.formatUnits(displayAmount, 18)} ${destToken === chainsConfig[chainId]?.tokens.WETH ? "ETH" : destToken === chainsConfig[chainId]?.tokens.USDC ? "USDC" : "USDT"
          } `}
      </div>

      {isBuyMode ? (
        <button disabled={loading} onClick={handleBuy} className="w-full bg-green-600 hover:bg-green-800 text-white p-2 rounded">
          {loading ? "Buying..." : "Buy Token on LiquidFun"}
        </button>
      ) : (
        <button disabled={loading} onClick={handleSell} className="w-full bg-red-600 hover:bg-red-800 text-white p-2 rounded">
          {loading ? "Selling..." : "Sell Token on LiquidFun"}
        </button>
      )}
      {errorMessage && <p className="text-red-500">{errorMessage}</p>}
    </div>
  );
}
