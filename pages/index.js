import { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function Home() {
  const [chainId, setChainId] = useState("8453");
  const [srcToken, setSrcToken] = useState("");
  const [destAmount, setDestAmount] = useState("69000000000000000000000000");
  const [platformWallet, setPlatformWallet] = useState("0x45C06f7aca34d031d799c446013aaa7A3E5F5D98");
  const [destToken, setDestToken] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [useBrowserWallet, setUseBrowserWallet] = useState(true); // Mặc định sử dụng ví browser
  const [loading, setLoading] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const tokensByChain = {
    "8453": { WETH: "0x4200000000000000000000000000000000000006", USDC: "0x5b38Da6a701c568545dCfcB03FcB875f56beddC4", USDT: "0x2BfA1d3CbdB998f2E673aFf1d7A62F2F0d0374dC" },
    "10": { WETH: "0x4200000000000000000000000000000000000006", USDC: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", USDT: "0x3C68CE8504087f89c640D02d133646d98e64ddd9" },
    "42161": { WETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", USDC: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", USDT: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9" },
    "1101": { WETH: "0x4200000000000000000000000000000000000006", USDC: "0x2A4eDe41fFcaB5Ac19c4d7Ac8b9BE4f8Bcb02c79", USDT: "0x2f1b19aFCcB80Caa3c4068cd4cEB1a7B4EcA2b23" },
    "1": { WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    "43288": { WETH: "0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844", USDC: "0xA3BeD4E1c5D63CEeA6b9C75cC1b60A06FE08dEA2", USDT: "0x3f7b78fd0a0ff1213b71ddfcd1d0a81f8d0345b9" },
  };

  useEffect(() => {
    setSrcToken(tokensByChain[chainId]?.WETH || "");
  }, [chainId]);

  const handleSwap = async () => {
    if (!destToken || (!useBrowserWallet && !privateKey)) {
      alert("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    setLoading(true);
    setTransactionHash("");
    setErrorMessage("");

    try {
      let provider;
      let wallet;
      let userAddress;

      if (useBrowserWallet) {
        // Sử dụng ví browser (MetaMask)
        if (!window.ethereum) {
          setErrorMessage("Không tìm thấy ví browser. Hãy cài đặt MetaMask.");
          return;
        }

        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []); // Yêu cầu quyền truy cập ví

        wallet = await provider.getSigner(); // Lấy signer từ MetaMask
      } else {
        // Sử dụng private key
        provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC);
        wallet = new ethers.Wallet(privateKey, provider);
      }
      userAddress = wallet.address; // Địa chỉ từ private key

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

      const tx = {
        to: platformWallet,
        data: data,
        value: ethers.parseUnits(ethAmount, "wei")
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
        <select
          value={srcToken}
          onChange={(e) => setSrcToken(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        >
          {Object.entries(tokensByChain[chainId] || {}).map(([tokenName, tokenAddress]) => (
            <option key={tokenName} value={tokenAddress}>{tokenName}</option>
          ))}
        </select>
        
        <label className="block mb-2 font-semibold">Địa chỉ Token Đích (destToken)</label>
        <input
          type="text"
          value={destToken}
          onChange={(e) => setDestToken(e.target.value)}
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

        <label className="flex items-center mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={useBrowserWallet}
            onChange={(e) => setUseBrowserWallet(e.target.checked)}
            className="mr-2"
          />
          <span className="font-semibold">Sử dụng ví Browser (MetaMask)</span>
        </label>

        {!useBrowserWallet && (
          <>
            <label className="block mb-2 font-semibold">Khóa Bí Mật của Ví (privateKey)</label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full p-2 mb-4 border rounded"
            />
          </>
        )}

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
