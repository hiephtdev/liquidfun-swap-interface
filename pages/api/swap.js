// pages/api/swap.js

import { ethers } from "ethers";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { chainId, srcToken, destAmount, platformWallet, destToken, privateKey } = req.body;

    if (!chainId || !srcToken || !destAmount || !platformWallet || !destToken || !privateKey) {
        return res.status(400).json({ error: "Thiếu thông tin đầu vào" });
    }

    try {
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC);
        const wallet = new ethers.Wallet(privateKey, provider);
        const userAddress = wallet.address;

        const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${chainId}&src=${srcToken}&dest=${destToken}&destAmount=${destAmount}&platformWallet=${platformWallet}&userAddress=${userAddress}`;

        // Sử dụng fetch để gọi API với các headers cần thiết
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                Accept: "application/json, text/plain, */*",
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}`,
            },
        });
        console.log("API response:", response);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Lỗi API:", errorText);
            return res.status(response.status).json({ error: "Lỗi khi gọi API", details: errorText });
        }

        const responseData = await response.json();
        const data = responseData.rates[0].txObject.data;
        const ethAmount = responseData.rates[0].amount;

        const tx = {
            to: platformWallet,
            data: data,
            value: ethers.parseUnits(ethAmount, "wei"),
        };

        const transaction = await wallet.sendTransaction(tx);

        res.status(200).json({ transactionHash: transaction.hash });
    } catch (error) {
        console.error("Lỗi khi thực hiện giao dịch:", error);
        res.status(500).json({ error: "Giao dịch thất bại", details: error.shortMessage || error.message });
    }
}
