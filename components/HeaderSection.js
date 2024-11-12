import React from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { chainsConfig } from "@/constants/common";

const HeaderSection = ({ state, connectWallet, disconnectWallet }) => {
  const formatWalletAddress = (address) => {
    return address ? `${address.slice(0, 6)}...${address.slice(-5)}` : "";
  };

  return (
    <>
      <div className="flex justify-center items-center mb-2 space-x-4">
        <img src="/default_logo.png" alt="Logo" className="h-16 w-auto" />
        <h1 className="text-3xl font-semibold text-gray-800">
          {state.isBuyMode ? "Buy Token" : "Sell Token"}
        </h1>
      </div>
      <Popover className="text-center mb-4">
        <PopoverButton
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition focus:border-none focus:outline-none"
          onClick={(e) => {
            if (!state.walletAddress) {
              e.preventDefault(); // Prevent opening the popover if not connected
              connectWallet();
            }
          }}
        >
          {state.walletAddress
            ? `${formatWalletAddress(state.walletAddress)} - ${Number.parseFloat(state.ethBalance).toFixed(6)} ETH`
            : "Connect Wallet"}
        </PopoverButton>

        <PopoverPanel
          anchor="bottom end"
          className="absolute z-10 mt-2 w-64 bg-white shadow-lg rounded-lg p-4 border border-gray-200"
        >
          {state.walletAddress && (
            <>
              <p className="text-sm font-medium text-gray-700 mb-2">Connected Wallet:</p>
              <p className="text-xs text-gray-500 mb-4 overflow-hidden whitespace-nowrap text-ellipsis">
                <a
                  href={`${chainsConfig[state.chainId]?.scanUrl}/address/${state.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {state.walletAddress}
                </a>
              </p>
              <p className="text-sm font-bold text-gray-700 mb-2">
                Balance: {Number.parseFloat(state.ethBalance).toFixed(6)} ETH
              </p>
              <button
                onClick={disconnectWallet}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition"
              >
                Disconnect Wallet
              </button>
            </>
          )}
        </PopoverPanel>
      </Popover>
    </>
  );
};

export default HeaderSection;
