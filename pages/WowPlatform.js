import React, { useState } from "react";
import { ethers } from "ethers";

export default function WowPlatform({ rpcUrl, isBuyMode, wallet, contractAddress, amount, useBrowserWallet, handleTransactionComplete, loadBalance }) {
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // Hàm tạo instance của contract, sử dụng trực tiếp `wallet` đã cấu hình
    const getContractInstance = () => new ethers.Contract(
        contractAddress,
        [
            "function buy(address recipient, address refundRecipient, address orderReferrer, string comment, uint8 expectedMarketType, uint256 minOrderSize, uint160 sqrtPriceLimitX96)",
            "function sell(uint256 tokensToSell, address recipient, address orderReferrer, string comment, uint8 expectedMarketType, uint256 minPayoutSize, uint160 sqrtPriceLimitX96)"
        ],
        wallet
    );

    // Hàm xử lý giao dịch
    const handleTransaction = async () => {
        try {
            setLoading(true);
            setErrorMessage("");
            handleTransactionComplete("");
            const contract = getContractInstance();
            let transaction = {};

            if (useBrowserWallet) {
                // Giao dịch khi dùng ví trên trình duyệt
                if (isBuyMode) {
                    transaction = await contract.buy(
                        wallet.address,
                        wallet.address,
                        ethers.ZeroAddress,
                        "",
                        0,
                        ethers.parseUnits("0", 18),
                        0n,
                        { value: ethers.parseEther(amount) }
                    );
                } else {
                    transaction = await contract.sell(
                        amount,
                        wallet.address,
                        ethers.ZeroAddress,
                        "",
                        0,
                        ethers.parseUnits("0", 18),
                        0n
                    );
                }
            } else {
                // Giao dịch khi dùng RPC
                transaction = await executeTransaction(contract, isBuyMode);
            }

            await transaction.wait();
            handleTransactionComplete(transaction.hash);
            loadBalance(wallet.address);
        } catch (error) {
            console.error("Lỗi khi thực hiện giao dịch trên Wow:", error);
            setErrorMessage(`Error executing transaction: ${error.shortMessage ?? error.message ?? error}`);
        } finally {
            setLoading(false);
        }
    };

    // Hàm thực hiện giao dịch với ước tính gas, chỉ khi `useBrowserWallet` là `false`
    const executeTransaction = async (contract, isBuyMode) => {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const gasData = await provider.getFeeData();

        if (isBuyMode) {
            const estimatedGas = await contract.buy.estimateGas(
                wallet.address,
                wallet.address,
                ethers.ZeroAddress,
                "",
                0,
                ethers.parseUnits("0", 18),
                0n,
                { value: ethers.parseEther(amount) }
            );
            const gasLimit = estimatedGas * BigInt(300) / BigInt(100);

            return await contract.buy(
                wallet.address,
                wallet.address,
                ethers.ZeroAddress,
                "",
                0,
                ethers.parseUnits("0", 18),
                0n,
                { value: ethers.parseEther(amount), gasLimit, gasPrice: gasData.gasPrice * 2n }
            );
        } else {
            const estimatedGas = await contract.sell.estimateGas(
                amount,
                wallet.address,
                ethers.ZeroAddress,
                "",
                0,
                ethers.parseUnits("0", 18),
                0n
            );
            const gasLimit = estimatedGas * BigInt(300) / BigInt(100);

            return await contract.sell(
                amount,
                wallet.address,
                ethers.ZeroAddress,
                "",
                0,
                ethers.parseUnits("0", 18),
                0n,
                { gasLimit, gasPrice: gasData.gasPrice * 2n }
            );
        }
    };

    return (
        <div>
            <button
                onClick={handleTransaction}
                disabled={loading}
                className={`w-full p-2 rounded ${isBuyMode ? "bg-green-500" : "bg-red-500"} text-white font-medium`}
            >
                {loading ? isBuyMode ? "Buy..." : "Sell..." : isBuyMode ? "Buy Token on Wow" : "Sell Token on Wow"}
            </button>
            {errorMessage && (
                <p className="text-red-500 mt-4">{errorMessage}</p>
            )}
        </div>
    );
}
