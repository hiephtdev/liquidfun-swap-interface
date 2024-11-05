import { useState } from "react";
import { ethers } from "ethers";

export default function Home() {
    const [chainId, setChainId] = useState("8453");
    const [srcToken, setSrcToken] = useState("0x4200000000000000000000000000000000000006");
    const [destAmount, setDestAmount] = useState("69000000000000000000000000");
    const [platformWallet, setPlatformWallet] = useState("0x45C06f7aca34d031d799c446013aaa7A3E5F5D98");
    const [destToken, setDestToken] = useState("0xF3F14d2572Ee306c20B7062921C4F1f3918E7477");
    const [privateKey, setPrivateKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [transactionHash, setTransactionHash] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const handleSwap = async () => {
        if (!destToken || !privateKey) {
            alert("Vui lòng nhập đầy đủ thông tin.");
            return;
        }

        setLoading(true);
        setTransactionHash("");
        setErrorMessage("");

        try {
            const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC);
            const wallet = new ethers.Wallet(privateKey, provider);
            const userAddress = wallet.address;

            // Gọi API từ client-side
            const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${chainId}&src=${srcToken}&dest=${destToken}&destAmount=${destAmount}&platformWallet=${platformWallet}&userAddress=${userAddress}`;

            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    Accept: "application/json, text/plain, */*",
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Lỗi API:", errorText);
                setErrorMessage("Lỗi khi gọi API: " + errorText);
                return;
            }

            const responseData = await response.json();
            const data = responseData.rates[0].txObject.data;
            const ethAmount = responseData.rates[0].amount;

            // Thực hiện giao dịch với ethers.js
            const tx = {
                to: platformWallet,
                data: data,
                value: ethers.parseUnits(ethAmount, "wei"),
            };

            const transaction = await wallet.sendTransaction(tx);
            setTransactionHash(transaction.hash);

        } catch (error) {
            console.error("Lỗi khi thực hiện giao dịch:", error);
            setErrorMessage("Giao dịch thất bại: " + (error.shortMessage || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-10">
            <div className="max-w-md mx-auto bg-white p-6 rounded-md shadow-md">
                <h1 className="text-2xl font-bold mb-4">Swap Interface</h1>
                
                <label className="block mb-2 font-semibold">Chain ID</label>
                <select 
                    value={chainId} 
                    onChange={(e) => setChainId(e.target.value)} 
                    className="w-full p-2 mb-4 border rounded"
                >
                    <option value="8453">Base</option>
                    <option value="10">Optimism</option>
                    <option value="42161">Arbitrum</option>
                    <option value="1101">Polygon zkEVM</option>
                    <option value="1">Ethereum</option>
                    <option value="43288">Blast</option>
                </select>

                <label className="block mb-2 font-semibold">Token nguồn (srcToken)</label>
                <input
                    type="text"
                    value={srcToken}
                    onChange={(e) => setSrcToken(e.target.value)}
                    className="w-full p-2 mb-4 border rounded"
                />

                <label className="block mb-2 font-semibold">Số lượng Token đích (destAmount)</label>
                <input
                    type="text"
                    value={destAmount}
                    onChange={(e) => setDestAmount(e.target.value)}
                    className="w-full p-2 mb-4 border rounded"
                />

                <label className="block mb-2 font-semibold">Platform Wallet</label>
                <input
                    type="text"
                    value={platformWallet}
                    onChange={(e) => setPlatformWallet(e.target.value)}
                    className="w-full p-2 mb-4 border rounded"
                />

                <label className="block mb-2 font-semibold">Địa chỉ Token Đích (destToken)</label>
                <input
                    type="text"
                    value={destToken}
                    onChange={(e) => setDestToken(e.target.value)}
                    className="w-full p-2 mb-4 border rounded"
                />

                <label className="block mb-2 font-semibold">Khóa Bí Mật của Ví (privateKey)</label>
                <input
                    type="password"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    className="w-full p-2 mb-4 border rounded"
                />
                
                <button
                    onClick={handleSwap}
                    disabled={loading}
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition"
                >
                    {loading ? "Đang thực hiện giao dịch..." : "Thực hiện Giao dịch"}
                </button>

                {transactionHash && (
                    <p className="mt-4 font-bold text-green-600">
                        Giao dịch thành công. Hash: <a href={`https://etherscan.io/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer" className="underline">{transactionHash}</a>
                    </p>
                )}

                {errorMessage && (
                    <p className="mt-4 font-bold text-red-600">
                        Lỗi: {errorMessage}
                    </p>
                )}
            </div>
        </div>
    );
}
