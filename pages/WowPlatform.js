import React, { useState } from "react";
import { ethers } from "ethers";

export default function WowPlatform({ chainId, rpcUrl, isBuyMode, wallet, contractAddress, amount, useBrowserWallet, handleTransactionComplete, loadBalance, addTokenToStorage, extraGasForMiner, additionalGas }) {
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // Hàm tạo instance của contract, sử dụng trực tiếp `wallet` đã cấu hình
    const getContractInstance = async () => {
        let currentWallet = wallet;
        if (useBrowserWallet) {
            // check chainid
            if (wallet.chainId !== `eip155:${chainId}`) {
                await wallet.switchChain(parseInt(chainId));
            }
            const provider = await wallet.getEthersProvider();
            currentWallet = provider.getSigner();
        }
        return new ethers.Contract(
            contractAddress,
            [
                "function buy(address recipient, address refundRecipient, address orderReferrer, string comment, uint8 expectedMarketType, uint256 minOrderSize, uint160 sqrtPriceLimitX96)",
                "function sell(uint256 tokensToSell, address recipient, address orderReferrer, string comment, uint8 expectedMarketType, uint256 minPayoutSize, uint160 sqrtPriceLimitX96)"
            ],
            currentWallet
        )
    };

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
            const contract = await getContractInstance();
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
            debugger
            setErrorMessage(`Error executing transaction: ${error.reason ?? error.shortMessage ?? error.message ?? error}`);
        } finally {
            setLoading(false);
        }
    };

    // Hàm thực hiện giao dịch với ước tính gas, chỉ khi `useBrowserWallet` là `false`
    const executeTransaction = async (contract, isBuyMode) => {
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        if (isBuyMode) {
            let gasOptions = {};
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
            const gasData = await provider.getFeeData();
            if (extraGasForMiner) {
                gasOptions = { maxPriorityFeePerGas: gasData.maxPriorityFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"), maxFeePerGas: gasData.maxFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei") }
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
            const gasData = await provider.getFeeData();
            let gasOptions = {};
            if (extraGasForMiner) {
                gasOptions = { maxPriorityFeePerGas: gasData.maxPriorityFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"), maxFeePerGas: gasData.maxFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei") }
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
