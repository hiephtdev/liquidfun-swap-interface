import React, { useState } from "react";
import { ethers } from "ethers";

export default function MoonXPlatform({ rpcUrl, isBuyMode, wallet, tokenAdress, slippage, amount, useBrowserWallet, handleTransactionComplete }) {
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // Hàm tạo instance của contract, sử dụng trực tiếp `wallet` đã cấu hình
    const getContractInstance = () => new ethers.Contract(
        process.env.NEXT_PUBLIC_MOONX_CONTRACT_ADDRESS,
        [
            "function moonXBuy(address tokenOut, uint8 slippagePercentage, address referrer) external payable",
            "function moonXSell(address tokenIn, uint256[2] amountIns, uint8 slippagePercentage, address referrer) external"
        ],
        wallet
    );

    // Hàm xử lý giao dịch
    const handleTransaction = async () => {
        try {
            setLoading(true);
            setErrorMessage("");
            const contract = getContractInstance();
            let transaction;

            if (useBrowserWallet) {
                // Giao dịch khi dùng ví trên trình duyệt
                transaction = isBuyMode
                    ? await contract.moonXBuy(tokenAdress, slippage, ethers.ZeroAddress, { value: ethers.parseEther(amount) })
                    : await contract.moonXSell(tokenAdress, [0n, amount], slippage, ethers.ZeroAddress);
            } else {
                // Giao dịch khi dùng RPC, cần tính toán gas và thiết lập gas limit
                transaction = await executeTransaction(contract, isBuyMode);
            }

            await transaction.wait();
            handleTransactionComplete(transaction.hash);
        } catch (error) {
            console.error("Lỗi khi thực hiện giao dịch trên MoonX:", error);
            setErrorMessage("Error executing transaction");
        } finally {
            setLoading(false);
        }
    };

    // Hàm thực hiện giao dịch với ước tính gas, chỉ khi `useBrowserWallet` là `false`
    const executeTransaction = async (contract, isBuyMode) => {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const gasData = await provider.getFeeData();

        if (isBuyMode) {
            const estimatedGas = await contract.moonXBuy.estimateGas(
                tokenAdress,
                slippage,
                ethers.ZeroAddress,
                { value: ethers.parseEther(amount) }
            );
            const gasLimit = estimatedGas * BigInt(300) / BigInt(100);

            return await contract.moonXBuy(
                tokenAdress,
                slippage,
                ethers.ZeroAddress,
                { value: ethers.parseEther(amount), gasLimit, gasPrice: gasData.gasPrice * 2n }
            );
        } else {
            const estimatedGas = await contract.moonXSell.estimateGas(
                tokenAdress,
                [0n, amount],
                slippage,
                ethers.ZeroAddress
            );
            const gasLimit = estimatedGas * BigInt(300) / BigInt(100);

            return await contract.moonXSell(
                tokenAdress,
                [0n, amount],
                slippage,
                ethers.ZeroAddress,
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
                {loading ? isBuyMode ? "Buy ..." : "Sell ..." : isBuyMode ? "Buy Token on MoonX" : "Sell Token on MoonX"}
            </button>
            {errorMessage && (
                <p className="text-red-500 mt-4">{errorMessage}</p>
            )}
        </div>
    );
}
