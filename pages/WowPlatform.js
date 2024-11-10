import React, { useState } from "react";
import { ethers } from "ethers";

export default function WowPlatform({ rpcUrl, isBuyMode, wallet, contractAddress, amount, useBrowserWallet, handleTransactionComplete, loadBalance, handleChainSwitch, addTokenToStorage, extraGasForMiner }) {
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
            setErrorMessage("");
            handleTransactionComplete("");
            if (!contractAddress) {
                setErrorMessage("Contract address is not set.");
                return;
            }
            if (!amount || amount === "0") {
                setErrorMessage("Invalid amount.");
                return;
            }
            setLoading(true);
            const chainSwitched = await handleChainSwitch();
            if (!chainSwitched) return;
            const contract = getContractInstance();
            let transaction = {};

            if (isBuyMode) {
                addTokenToStorage(contractAddress);
            }

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
            let gasOptions = {};
            if (extraGasForMiner) {
                gasOptions = { maxPriorityFeePerGas: gasData.maxPriorityFeePerGas, maxFeePerGas: gasData.maxFeePerGas }
            } else {
                gasOptions = { gasPrice: gasData.gasPrice * 2n }
            }
            return await contract.buy(
                wallet.address,
                wallet.address,
                ethers.ZeroAddress,
                "",
                0,
                ethers.parseUnits("0", 18),
                0n,
                { value: ethers.parseEther(amount), gasLimit, ...gasOptions }
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
            let gasOptions = {};
            if (extraGasForMiner) {
                gasOptions = { maxPriorityFeePerGas: gasData.maxPriorityFeePerGas, maxFeePerGas: gasData.maxFeePerGas }
            } else {
                gasOptions = { gasPrice: gasData.gasPrice * 2n }
            }
            return await contract.sell(
                amount,
                wallet.address,
                ethers.ZeroAddress,
                "",
                0,
                ethers.parseUnits("0", 18),
                0n,
                { gasLimit, ...gasOptions }
            );
        }
    };

    return (
        <div>
            <button
                onClick={handleTransaction}
                disabled={loading}
                className={`w-full p-2 rounded ${isBuyMode ? "bg-green-600 hover:bg-green-800" : "bg-red-600 hover:bg-red-800"} text-white font-medium`}
            >
                {loading ? isBuyMode ? "Buy..." : "Sell..." : isBuyMode ? "Buy Token on Wow" : "Sell Token on Wow"}
            </button>
            {errorMessage && (
                <p className="text-red-500 mt-4">{errorMessage}</p>
            )}
        </div>
    );
}
