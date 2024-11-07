import React, { useState } from "react";
import { ethers } from "ethers";

export default function MoonXPlatform({ isBuyMode, wallet, tokenAdress, slippage, amount, handleTransactionComplete }) {
    const [errorMessage, setErrorMessage] = useState("");

    const handleTransaction = async () => {
        try {
            const contract = new ethers.Contract(
                "0x3D60C944abAF410ec3ad0F2392Eb4A8EC4cc4568",
                [
                    "function moonXBuy(address tokenOut, uint8 slippagePercentage, address referrer) external payable",
                    "function moonXSell(address tokenIn, uint8 percentage, uint8 slippagePercentage, address referrer) external"
                ],
                wallet
            );
            let transaction = isBuyMode
                ? await contract.moonXBuy(tokenAdress, slippage, ethers.ZeroAddress, { value: ethers.parseEther(amount) })
                : await contract.moonXSell(tokenAdress, amount, slippage, ethers.ZeroAddress);

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
