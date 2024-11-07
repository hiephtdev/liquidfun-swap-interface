import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function LiquidFunPlatform({ isBuyMode, wallet, amount, platformWallet, srcToken, destToken, chainId, slippage, handleTransactionComplete }) {
    const [errorMessage, setErrorMessage] = useState("");
    const [displayAmount, setDisplayAmount] = useState("0");

    // Hàm để cập nhật giá hiển thị với slippage cho người dùng
    const fetchPrice = async () => {
        try {
            if (!destToken || !srcToken) {
                return;
            }
            const queryParam = isBuyMode ? "destAmount" : "srcAmount";
            const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${chainId}&src=${srcToken}&dest=${destToken}&${queryParam}=${amount}`;
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}` },
            });

            if (!response.ok) {
                throw new Error(`API Error: ${await response.text()}`);
            }

            const responseData = await response.json();
            const { amount: apiAmount } = responseData.rates[0];

            // Tính toán slippage để hiển thị cho người dùng
            const slippageAdjustedAmount = isBuyMode
                ? BigInt(apiAmount) * BigInt(100 + slippage) / 100n
                : BigInt(apiAmount) * BigInt(100 - slippage) / 100n;

            setDisplayAmount(slippageAdjustedAmount.toString());
        } catch (error) {
            console.error("Lỗi khi cập nhật giá hiển thị:", error);
            setErrorMessage("Lỗi khi cập nhật giá hiển thị.");
        }
    };

    // Gọi API cập nhật giá hiển thị mỗi khi thay đổi chế độ mua/bán, amount, hoặc slippage
    useEffect(() => {
        fetchPrice();
    }, [isBuyMode, amount, srcToken, destToken, slippage]);

    const handleBuy = async () => {
        try {
            // Lấy giá trị chính xác cho giao dịch từ API để tránh dữ liệu cũ
            const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${chainId}&src=${srcToken}&dest=${destToken}&destAmount=${amount}`;
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}` },
            });

            if (!response.ok) {
                throw new Error(`API Error: ${await response.text()}`);
            }

            const { data, amount: apiAmount } = await response.json();

            // Tính toán slippage cho giá trị giao dịch thực tế
            const slippageAdjustedAmount = BigInt(apiAmount) * BigInt(100 + slippage) / 100n;

            const tx = await wallet.sendTransaction({
                to: platformWallet,
                data: data,
                value: ethers.parseEther(slippageAdjustedAmount.toString()) // Sử dụng giá trị sau khi đã tính slippage cho giao dịch
            });

            await tx.wait();
            handleTransactionComplete(tx.hash);
        } catch (error) {
            console.error("Lỗi khi thực hiện giao dịch mua trên LiquidFun:", error);
            setErrorMessage("Lỗi khi thực hiện giao dịch mua trên LiquidFun.");
        }
    };

    const handleSell = async () => {
        try {
            const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${chainId}&src=${srcToken}&dest=${destToken}&srcAmount=${amount}`;
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}` },
            });

            if (!response.ok) {
                throw new Error(`API Error: ${await response.text()}`);
            }

            const { data } = await response.json();

            const tx = await wallet.sendTransaction({
                to: platformWallet,
                data: data,
                value: 0 // Giao dịch bán không yêu cầu gửi giá trị ETH trực tiếp
            });
            await tx.wait();
            handleTransactionComplete(tx.hash);
        } catch (error) {
            console.error("Lỗi khi thực hiện giao dịch bán trên LiquidFun:", error);
            setErrorMessage("Lỗi khi thực hiện giao dịch bán trên LiquidFun.");
        }
    };

    return (
        <div>
            <div className="mb-4 text-center text-gray-700">
                {isBuyMode
                    ? `Amount to pay (with slippage): ${ethers.formatUnits(displayAmount, 18)} ${srcToken}`
                    : `Amount to receive (with slippage): ${ethers.formatUnits(displayAmount, 18)} ${destToken}`}
            </div>

            {isBuyMode ? (
                <button onClick={handleBuy} className="w-full bg-green-500 text-white p-2 rounded">Buy Token on LiquidFun</button>
            ) : (
                <button onClick={handleSell} className="w-full bg-red-500 text-white p-2 rounded">Sell Token on LiquidFun</button>
            )}
            {errorMessage && <p className="text-red-500">{errorMessage}</p>}
        </div>
    );
}
