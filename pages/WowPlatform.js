import React, { useState } from "react";
import { ethers } from "ethers";

export default function WowPlatform({ chainId, rpcUrl, isBuyMode, wallet, contractAddress, amount, useBrowserWallet, handleTransactionComplete, loadBalance, addTokenToStorage, extraGasForMiner, additionalGas, removeTokenFromStorage }) {
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // Function to create an instance of the contract using the configured `wallet`
    const getContractInstance = async () => {
        let currentWallet = wallet;
        if (useBrowserWallet) {
            // Check chain ID
            if (wallet.chainId !== `eip155:${chainId}`) {
                await wallet.switchChain(parseInt(chainId));
            }
            const provider = await wallet.getEthersProvider();
            currentWallet = provider.getSigner();
        }
        return new ethers.Contract(
            process.env.NEXT_PUBLIC_MOONX_WOW_CONTRACT_ADDRESS,
            [
                "function placeOrder(address token, uint256 amount, bool isBuy)"
            ],
            currentWallet
        );
    };

    // Hàm tạo instance của token để thực hiện lệnh `approve`
    const getTokenContractInstance = async () => {
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
                "function symbol() view returns (string)",
                "function decimals() view returns (uint8)",
                "function balanceOf(address) view returns (uint256)",
                "function approve(address spender, uint256 amount) external returns (bool)",
                "function allowance(address owner, address spender) view returns (uint256)"
            ],
            currentWallet
        )
    };

    // Function to handle the transaction
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

            const transactionOptions = isBuyMode ? { value: ethers.parseEther(amount) } : {};
            if (useBrowserWallet) {
                if (!isBuyMode) {
                    await approve();
                }
                // Transaction when using the browser wallet
                transaction = await contract.placeOrder(
                    contractAddress,
                    isBuyMode ? ethers.parseEther(amount) : amount,
                    isBuyMode,
                    transactionOptions
                );
            } else {
                // Transaction when using RPC
                transaction = await executeTransaction(isBuyMode);
            }
            await transaction.wait();
            handleTransactionComplete(transaction.hash);
            loadBalance(wallet.address);
            if (!isBuyMode) {
                removeTokenFromStorage(contractAddress);
            }
        } catch (error) {
            setErrorMessage(`Error executing transaction: ${error.reason ?? error.shortMessage ?? error.message ?? error}`);
        } finally {
            setLoading(false);
        }
    };

    // Hàm xử lý `approve` và thực hiện giao dịch bán
    const approve = async () => {
        const contract = await getTokenContractInstance();
        const spenderAddress = process.env.NEXT_PUBLIC_MOONX_WOW_CONTRACT_ADDRESS;

        // Kiểm tra allowance
        const allowance = await contract.allowance(wallet.address, spenderAddress);
        if (allowance < amount) {
            // Nếu allowance chưa đủ, thực hiện approve
            const approveTx = await contract.approve(spenderAddress, amount);
            await approveTx.wait();
        }
    };

    // Function to execute transaction with estimated gas, only when `useBrowserWallet` is `false`
    const executeTransaction = async (isBuyMode) => {
        const contract = await getContractInstance();
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const transactionOptions = isBuyMode ? { value: ethers.parseEther(amount) } : {};

        let gasOptions = {};
        const estimatedGas = await contract.placeOrder.estimateGas(
            contractAddress,
            isBuyMode ? ethers.parseEther(amount) : amount,
            isBuyMode,
            transactionOptions
        );
        const gasLimit = estimatedGas * BigInt(300) / BigInt(100);
        const gasData = await provider.getFeeData();

        if (extraGasForMiner) {
            gasOptions = { maxPriorityFeePerGas: gasData.maxPriorityFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"), maxFeePerGas: gasData.maxFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei") };
        } else {
            gasOptions = { gasPrice: gasData.gasPrice * 2n };
        }

        return await contract.placeOrder(
            contractAddress,
            isBuyMode ? ethers.parseEther(amount) : amount,
            isBuyMode,
            { gasLimit, ...gasOptions, ...transactionOptions }
        );
    };

    return (
        <div>
            <button
                onClick={handleTransaction}
                disabled={loading}
                className={`w-full p-2 rounded ${isBuyMode ? "bg-green-600 hover:bg-green-800" : "bg-red-600 hover:bg-red-800"} text-white font-medium`}
            >
                {loading ? isBuyMode ? "Buying..." : "Selling..." : isBuyMode ? "Buy Token on Wow" : "Sell Token on Wow"}
            </button>
            {errorMessage && (
                <p className="text-red-500 mt-4">{errorMessage}</p>
            )}
        </div>
    );
}
