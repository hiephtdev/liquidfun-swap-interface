import React from "react";
import LiquidFunPlatform from "./LiquidFunPlatform";
import WowPlatform from "./WowPlatform";
import MoonXPlatform from "./MoonXPlatform";
import { chainsConfig } from "@/constants/common";

const PlatformComponent = ({ platform, state, wallet, handleStateChange, fetchTokenBalance, fetchWETHBalance }) => {
  const handleTransactionComplete = (hash) => {
    handleStateChange("transactionHash", hash);
  };

  const addTokenToStorage = (address) => {
    // Add the token to local storage and update the state with the new list
    const newToken = { address };
    const updatedTokens = [...state.purchasedTokens, newToken];
    localStorage.setItem(`mys:${state.platform}-purchasedTokens`, JSON.stringify(updatedTokens));
    handleStateChange("purchasedTokens", updatedTokens);
  };

  const removeTokenFromStorage = (address) => {
    // Remove the token from local storage and update the state with the filtered list
    const updatedTokens = state.purchasedTokens.filter((token) => token.address !== address);
    localStorage.setItem(`mys:${state.platform}-purchasedTokens`, JSON.stringify(updatedTokens));
    handleStateChange("purchasedTokens", updatedTokens);
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
          removeTokenFromStorage={removeTokenFromStorage}
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
          removeTokenFromStorage={removeTokenFromStorage}
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
          removeTokenFromStorage={removeTokenFromStorage}
          referral={state.ref}
          additionalGas={state.additionalGas}
        />
      )}
    </>
  );
};

export default PlatformComponent;
