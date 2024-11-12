import { chainsConfig } from "@/constants/common";
import { ethers } from "ethers";
import React, { useState } from "react";

const TokenSelector = ({ state, handleStateChange, handleToggleMode, fetchTokenBalance, getProvider }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchTokenSymbol = async (tokenAddress) => {
    const provider = getProvider();
    const contract = new ethers.Contract(tokenAddress, ["function symbol() view returns (string)"], provider);
    try {
      const symbol = await contract.symbol();
      handleStateChange("symbolSuggestion", symbol);
    } catch {
      handleStateChange("symbolSuggestion", "Not found");
    }
  };

  const handlePercentageClick = (percentage) => {
    const amount = (BigInt(state.balance) * BigInt(percentage) / 100n).toString();
    handleStateChange("amount", amount);
  };

  const tokenInputField = (tokenField, placeholder) => (
    <>
      <input
        type="text"
        value={state[tokenField]}
        onChange={(e) => {
          const tokenAddress = e.target.value;
          handleStateChange(tokenField, tokenAddress)
          if (tokenAddress.length === 42) {
            fetchTokenSymbol(tokenAddress);
          } else {
            handleStateChange("symbolSuggestion", null);
          }
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="w-full p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
      />
      {showSuggestions && (state.purchasedTokens.length > 0 || state.symbolSuggestion) && (
        <ul className="absolute w-full max-w-lg bg-white border border-gray-300 rounded-lg mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
          {state.symbolSuggestion ? (
            state.symbolSuggestion !== "Not found" ? (
              <li
                onMouseDown={() => {
                  handleStateChange(tokenField, state[tokenField]);
                  handleStateChange("symbolSuggestion", null);
                }}
                className="p-2 cursor-pointer hover:bg-gray-100 text-black"
              >
                {state.symbolSuggestion ? `${state.symbolSuggestion} (${state[tokenField]})` : "Not found"}
              </li>
            ) : (
              <li className="p-2 text-red-500">Not found</li>
            )
          ) : (
            state.purchasedTokens.map((token, index) => (
              <li
                key={index}
                onMouseDown={() => handleStateChange(tokenField, token.address)}
                className="p-2 cursor-pointer hover:bg-gray-100"
              >
                {token.symbol ? `${token.symbol} (${token.address})` : "Not found"}
              </li>
            ))
          )}
        </ul>
      )}
    </>
  );

  return (
    <>
      {/* From Token Field */}
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-600">
          From Token
        </label>
        {state.isBuyMode ? (
          <select
            value={state.srcToken}
            onChange={(e) => handleStateChange("srcToken", e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {Object.entries(chainsConfig[state.chainId].tokens).map(([tokenName, tokenAddress]) => (
              <option key={tokenName} value={tokenAddress}>
                {tokenName}
              </option>
            ))}
          </select>
        ) : (
          tokenInputField("srcToken", "Type or select token to sell")
        )}
      </div>

      {/* Toggle Buy/Sell Mode Button */}
      <div className="flex items-center justify-center mb-6">
        <button
          onClick={handleToggleMode}
          className="bg-gray-200 hover:bg-gray-300 p-3 rounded-full transition text-gray-600"
          title="Swap to sell/buy mode"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ color: "rgb(34, 34, 34)", width: "24px", height: "24px", transform: "rotate(0deg)" }}>
            <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 12L12 19L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* To Token Field */}
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-600">
          To Token
        </label>
        {!state.isBuyMode ? (
          <select
            value={state.destToken}
            onChange={(e) => handleStateChange("destToken", e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {Object.entries(chainsConfig[state.chainId].tokens).map(([tokenName, tokenAddress]) => (
              <option key={tokenName} value={tokenAddress}>
                {tokenName}
              </option>
            ))}
          </select>
        ) : (
          tokenInputField("destToken", "Type or select token to buy")
        )}
      </div>

      {/* Amount Input Field */}
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-600">Amount</label>
        <div className="flex items-center">
          <input
            type="text"
            value={state.amount}
            onChange={(e) => {
              // Chỉ cập nhật state nếu giá trị hợp lệ hoàn toàn (số hoặc số thập phân hoàn chỉnh)
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value)) {
                handleStateChange("amount", value);
              }
            }}
            onInput={(e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, '') }}
            className="flex-grow p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter amount"
          />
          {/* <button
            className="p-2"
            onClick={() => {
              if (state.isBuyMode) {
                // Fetch max buy limit or balance when in buy mode
                // Assuming fetchBuyLimit function exists in the main component
                fetchBuyLimit();
              } else {
                // Refresh token balance in sell mode
                fetchTokenBalance(state.walletAddress);
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              fill="currentColor"
              className="w-4 h-4">
              <path d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160 352 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l111.5 0c0 0 0 0 0 0l.4 0c17.7 0 32-14.3 32-32l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8c-.3 1.7-.4 3.4-.4 5.1L16 432c0 17.7 14.3 32 32 32s32-14.3 32-32l0-35.1 17.6 17.5c0 0 0 0 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.8c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352l34.4 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L48.4 288c-1.6 0-3.2 .1-4.8 .3s-3.1 .5-4.6 1z" />
            </svg>
          </button> */}
        </div>
      </div>

      {/* Percentage Buttons for Quick Amount Selection */}
      {!state.isBuyMode && (
        <div className="flex justify-between mb-4 text-gray-600">
          {["25%", "50%", "75%", "100%"].map((percentage, idx) => (
            <button
              key={idx}
              onClick={() => handlePercentageClick(parseInt(percentage))}
              className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg transition hover:bg-gray-200"
            >
              {percentage}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default TokenSelector;
