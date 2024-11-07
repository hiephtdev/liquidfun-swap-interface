import React, { useState } from "react";
import { ethers } from "ethers";

export default function WowPlatform({ isBuyMode, wallet, contractAddress, amount, handleTransactionComplete }) {
    const [errorMessage, setErrorMessage] = useState("");

    const handleTransaction = async () => {
        try {
            const contract = new ethers.Contract(
                contractAddress,
                [
                    "function buy(address recipient, address refundRecipient, address orderReferrer, string comment, uint8 expectedMarketType, uint256 minOrderSize, uint160 sqrtPriceLimitX96)",
                    "function sell(uint256 tokensToSell, address recipient, address orderReferrer, string comment, uint8 expectedMarketType, uint256 minPayoutSize, uint160 sqrtPriceLimitX96)"
                ],
                wallet
            );
            console.log("contract", contractAddress);
            let transaction = isBuyMode
                ? await contract.buy(wallet.address, wallet.address, ethers.ZeroAddress, "", 0, ethers.parseUnits("0", 18), 0n, { value: ethers.parseEther(amount) })
                : await contract.sell(amount, wallet.address, ethers.ZeroAddress, "", 0, ethers.parseUnits("0", 18), 0n);

            await transaction.wait();
            handleTransactionComplete(transaction.hash);
        } catch (error) {
            console.error("Lỗi khi thực hiện giao dịch trên Wow:", error);
            setErrorMessage("Lỗi khi thực hiện giao dịch trên Wow.");
        }
    };

    return (
        <div>
            <button
                onClick={handleTransaction}
                className={`w-full p-2 rounded ${isBuyMode ? "bg-green-500" : "bg-red-500"} text-white font-medium`}
            >
                {isBuyMode ? "Buy Token on Wow" : "Sell Token on Wow"}
            </button>
            {errorMessage && (
                <p className="text-red-500 mt-4">{errorMessage}</p>
            )}
        </div>
    );
}
