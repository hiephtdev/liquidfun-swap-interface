import React from "react";
import LiquidFunPlatform from "./LiquidFunPlatform";
import WowPlatform from "./WowPlatform";
import MoonXPlatform from "./MoonXPlatform";
import { chainsConfig } from "@/constants/common";

const PlatformComponent = ({ platform, state, wallet, handleStateChange, fetchTokenBalance, fetchWETHBalance }) => {
  const handleTransactionComplete = (hash) => {
    handleStateChange("transactionHash", hash);
  };

  const addTokenToStorage = async (tokenAddress) => {
    try {
      if (state.purchasedTokens.find(token => token.address === tokenAddress)) return;
      const provider = getProvider(state.chainId);
      const contract = new ethers.Contract(
        tokenAddress,
        ["function symbol() view returns (string)"],
        provider
      );
      const symbol = await contract.symbol();
      const newToken = { address: tokenAddress, symbol };
      const updatedTokens = [...state.purchasedTokens, newToken];
      localStorage.setItem(`mys:${state.platform}-2-purchasedTokens`, JSON.stringify(updatedTokens));
      setState((prevState) => ({ ...prevState, purchasedTokens: updatedTokens }));
    } catch (error) {
      console.error("Error fetching token symbol:", error);
    }
  };

  const loadBalance = (address) => {
    Promise.all([fetchWETHBalance(address), fetchTokenBalance(address)]);
  };

  // Conditional rendering based on the platform selection
  return (
    <>
      {platform === "liquidfun" && (
        <LiquidFunPlatform
          isBuyMode={state.isBuyMode}
          wallet={wallet}
          amount={state.amount}
          platformWallet={state.platformWallet}
          srcToken={state.srcToken}
          destToken={state.destToken}
          chainId={state.chainId}
          slippage={state.slippage}
          loadBalance={loadBalance}
          handleTransactionComplete={handleTransactionComplete}
          addTokenToStorage={addTokenToStorage}
        />
      )}
      {platform === "wow" && (
        <WowPlatform
          rpcUrl={chainsConfig[state.chainId]?.rpcUrl}
          isBuyMode={state.isBuyMode}
          wallet={wallet}
          contractAddress={state.isBuyMode ? state.destToken : state.srcToken}
          amount={state.amount}
          useBrowserWallet={state.useBrowserWallet}
          loadBalance={loadBalance}
          extraGasForMiner={state.extraGasForMiner}
          handleTransactionComplete={handleTransactionComplete}
          addTokenToStorage={addTokenToStorage}
          additionalGas={state.additionalGas}
          chainId={state.chainId}
        />
      )}
      {platform === "moonx" && (
        <MoonXPlatform
          chainId={state.chainId}
          rpcUrl={chainsConfig[state.chainId]?.rpcUrl}
          isBuyMode={state.isBuyMode}
          wallet={wallet}
          tokenAdress={state.isBuyMode ? state.destToken : state.srcToken}
          slippage={state.slippage}
          amount={state.amount}
          useBrowserWallet={state.useBrowserWallet}
          loadBalance={loadBalance}
          extraGasForMiner={state.extraGasForMiner}
          handleTransactionComplete={handleTransactionComplete}
          addTokenToStorage={addTokenToStorage}
          referral={state.ref}
          additionalGas={state.additionalGas}
        />
      )}
    </>
  );
};

export default PlatformComponent;
