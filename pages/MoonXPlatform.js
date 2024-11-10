import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { chainsConfig } from "@/constants/common";

export default function MoonXPlatform({ chainId, rpcUrl, isBuyMode, wallet, tokenAdress, slippage, amount, useBrowserWallet, handleTransactionComplete, loadBalance, addTokenToStorage, handleChainSwitch, extraGasForMiner }) {
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingAmountOut, setLoadingAmountOut] = useState(false);
    const [displayAmount, setDisplayAmount] = useState("0");

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
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)"
        ],
        wallet
    );

    // Hàm xử lý giao dịch
    const handleTransaction = async () => {
        try {
            setErrorMessage("");
            handleTransactionComplete("");
            if (!tokenAdress) {
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
            let gasOptions = {};
            if (extraGasForMiner) {
                gasOptions = { maxPriorityFeePerGas: gasData.maxPriorityFeePerGas, maxFeePerGas: gasData.maxFeePerGas }
            } else {
                gasOptions = { gasPrice: gasData.gasPrice * 2n }
            }

            return await contract.moonXBuy(
                tokenAdress,
                slippage,
                ethers.ZeroAddress,
                { value: ethers.parseEther(amount), gasLimit, ...gasOptions }
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
            let gasOptions = {};
            if (extraGasForMiner) {
                gasOptions = { maxPriorityFeePerGas: gasData.maxPriorityFeePerGas, maxFeePerGas: gasData.maxFeePerGas }
            } else {
                gasOptions = { gasPrice: gasData.gasPrice * 2n }
            }
            return await contract.moonXSell(
                tokenAdress,
                [0n, amount],
                slippage,
                ethers.ZeroAddress,
                { gasLimit, ...gasOptions }
            );
        }
    };

    useEffect(() => {
        const fetchAmountOutMin = async () => {
            try {
                setLoadingAmountOut(true);
                if (!tokenAdress || !ethers.isAddress(tokenAdress)) {
                    setDisplayAmount("0");
                    return;
                }
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const tokenContract = new ethers.Contract(
                    tokenAdress,
                    [
                        "function decimals() view returns (uint8)",
                        "function symbol() view returns (string)"
                    ],
                    provider
                );
                const getDecimals = async () => {
                    try {
                        if (!isBuyMode) return 18;
                        return tokenContract.decimals();
                    } catch (error) {
                        console.error(`Lỗi khi lấy số thập phân: ${error}`);
                        return 18;
                    }
                }

                const getSymbol = async () => {
                    try {
                        if (!isBuyMode) return "ETH";
                        return tokenContract.symbol();
                    } catch (error) {
                        console.error(`Lỗi khi lấy symbol: ${error}`);
                        return "";
                    }
                }

                const [amountOut, decimals, symbol] = await Promise.all([
                    calculateAmountsOutMin({
                        tokenIn: isBuyMode ? chainsConfig[chainId].tokens.WETH : tokenAdress,
                        tokenOut: isBuyMode ? tokenAdress : chainsConfig[chainId].tokens.WETH,
                        amountIn: isBuyMode ? ethers.parseEther(amount) : amount,
                        slippagePercentage: slippage
                    }),
                    getDecimals(),
                    getSymbol()
                ]);


                let formattedValue = `${amountOut}`;
                try {
                    const value = ethers.formatUnits(formattedValue, decimals);
                    formattedValue = new Intl.NumberFormat('en-US', {
                        style: 'decimal',
                        maximumFractionDigits: 5
                    }).format(value);
                } catch (error) {
                    console.error(`Lỗi khi xử lý sự kiện: ${error}`);
                    return;
                }

                setDisplayAmount(`${formattedValue} ${symbol}`);
            } catch (error) {
                console.error(`Lỗi khi lấy số lượng nhỏ nhất: ${error}`);
                setDisplayAmount("0");
            } finally {
                setLoadingAmountOut(false);
            }
        };

        // Thiết lập khoảng thời gian để gọi hàm sau mỗi 10 giây
        const intervalId = setInterval(fetchAmountOutMin, 10000);

        // Gọi hàm lần đầu ngay lập tức
        fetchAmountOutMin();

        // Hủy khoảng thời gian khi component bị unmount
        return () => clearInterval(intervalId);

        // Không trả về hàm async từ useEffect
    }, [isBuyMode, amount, tokenAdress, slippage, chainId]);

    const calculateAmountsOutMin = async ({
        tokenIn,
        tokenOut,
        amountIn,
        slippagePercentage,
        feeTiers = [500, 3000, 10000], // Các mức phí thường dùng trong Uniswap V3
    }) => {

        // ABI tối giản chỉ bao gồm các hàm cần thiết
        const factoryAbi = [
            "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)"
        ];

        const quoterAbi = [
            {
                "inputs": [
                    {
                        "components": [
                            { "internalType": "address", "name": "tokenIn", "type": "address" },
                            { "internalType": "address", "name": "tokenOut", "type": "address" },
                            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
                            { "internalType": "uint24", "name": "fee", "type": "uint24" },
                            { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
                        ],
                        "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
                        "name": "params",
                        "type": "tuple"
                    }
                ],
                "name": "quoteExactInputSingle",
                "outputs": [
                    { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
                    { "internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160" },
                    { "internalType": "uint32", "name": "initializedTicksCrossed", "type": "uint32" },
                    { "internalType": "uint256", "name": "gasEstimate", "type": "uint256" }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ];;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        // Khởi tạo các contract factory và quoter với ABI tối giản
        const factory = new ethers.Contract(chainsConfig[chainId].factory, factoryAbi, provider);
        const quoter = new ethers.Contract(chainsConfig[chainId].quote, quoterAbi, provider);

        if (amountIn <= 0n) return 0n;
        if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
            return 0n;
        }

        let bestQuote = 0n;

        // Duyệt qua từng `feeTiers` để tìm `amountOut` tốt nhất
        for (const fee of feeTiers) {
            try {
                // Kiểm tra sự tồn tại của pool
                const poolAddress = await factory.getPool(tokenIn, tokenOut, fee);
                if (poolAddress === ethers.ZeroAddress) {
                    continue; // Bỏ qua nếu không có pool tồn tại
                }

                console.log("Pool address:", poolAddress);
                console.log("Fee tier:", fee);
                console.log("Amount in:", amountIn);
                console.log("Slippage percentage:", slippagePercentage);
                console.log("Token in:", tokenIn);
                console.log("Token out:", tokenOut);
                console.log("Quote address:", chainsConfig[chainId].quote);

                // Tạo tham số đầu vào cho hàm quoteExactInputSingle
                const params = {
                    tokenIn,
                    tokenOut,
                    amountIn,
                    fee,
                    sqrtPriceLimitX96: 0 // Không giới hạn giá
                };

                // Gọi `quoteExactInputSingle` để lấy báo giá cho pool tồn tại
                const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = await quoter.quoteExactInputSingle.staticCallResult(params);
                if (amountOut > bestQuote) {
                    bestQuote = amountOut;
                }
            } catch (error) {
                console.error("Quote failed for fee tier:", fee, error);
                continue; // Bỏ qua nếu lỗi xảy ra
            }
        }

        if (bestQuote === 0n) {
            return 0n;
        }

        // Tính toán amountOutMin với độ trượt giá
        const slippage = (bestQuote * BigInt(slippagePercentage)) / 100n;
        const amountOutMin = bestQuote - slippage;

        return amountOutMin;
    }

    return (
        <div>
            <div className={`mb-4 text-center ${isBuyMode ? "text-red-600" : "text-green-600"} italic font-semibold`}>
                {isBuyMode
                    ? `Amount to receive (with slippage): ${!loadingAmountOut ? displayAmount : `...`}`
                    : `Amount to receive (with slippage): ${!loadingAmountOut ? displayAmount : `...`} `}
            </div>
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
