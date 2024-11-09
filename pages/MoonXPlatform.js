import React, { useState } from "react";
import { ethers } from "ethers";

export default function MoonXPlatform({ rpcUrl, isBuyMode, wallet, tokenAdress, slippage, amount, useBrowserWallet, handleTransactionComplete, loadBalance, addTokenToStorage }) {
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

    // Hàm tạo instance của token để thực hiện lệnh `approve`
    const getTokenContractInstance = () => new ethers.Contract(
        tokenAdress,
        [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)"
        ],
        wallet
    );

    // Hàm xử lý giao dịch
    const handleTransaction = async () => {
        try {
            setLoading(true);
            setErrorMessage("");
            handleTransactionComplete("");
            const chainSwitched = await handleChainSwitch();
            if (!chainSwitched) return;
            const contract = getContractInstance();
            let transaction;

            if (isBuyMode) {
                addTokenToStorage(tokenAdress);
            }

            if (useBrowserWallet) {
                // Thực hiện giao dịch khi dùng ví trên trình duyệt
                transaction = isBuyMode
                    ? await contract.moonXBuy(tokenAdress, slippage, ethers.ZeroAddress, { value: ethers.parseEther(amount) })
                    : await handleSellWithApprove(contract);
            } else {
                // Thực hiện giao dịch khi dùng RPC, cần tính toán gas và thiết lập gas limit
                transaction = await executeTransaction(contract, isBuyMode);
            }

            await transaction.wait();
            handleTransactionComplete(transaction.hash);
            loadBalance(wallet.address);
        } catch (error) {
            console.error("Lỗi khi thực hiện giao dịch trên MoonX:", error);
            setErrorMessage(`Error executing transaction: ${error.shortMessage ?? error.message ?? error}`);
        } finally {
            setLoading(false);
        }
    };

    // Hàm xử lý `approve` và thực hiện giao dịch bán
    const handleSellWithApprove = async (contract) => {
        const tokenContract = getTokenContractInstance();
        const spenderAddress = process.env.NEXT_PUBLIC_MOONX_CONTRACT_ADDRESS;

        // Kiểm tra allowance
        const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
        if (allowance < amount) {
            // Nếu allowance chưa đủ, thực hiện approve
            const approveTx = await tokenContract.approve(spenderAddress, amount);
            await approveTx.wait();
        }

        // Sau khi approve, thực hiện lệnh bán
        return await contract.moonXSell(tokenAdress, [0n, amount], slippage, ethers.ZeroAddress);
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
            const tokenContract = getTokenContractInstance();
            const spenderAddress = process.env.NEXT_PUBLIC_MOONX_CONTRACT_ADDRESS;

            // Kiểm tra allowance
            const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
            if (allowance < amount) {
                const approveTx = await tokenContract.approve(spenderAddress, amount);
                await approveTx.wait();
            }

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
