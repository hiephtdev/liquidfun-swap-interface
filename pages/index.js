import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import LiquidFunPlatform from "./LiquidFunPlatform";
import WowPlatform from "./WowPlatform";
import MoonXPlatform from "./MoonXPlatform";
import { chainsConfig } from "@/constants/common";

export default function Home() {
  const [state, setState] = useState({
    chainId: "8453",
    platform: "wow",
    srcToken: "", // Token gốc
    destToken: "", // Token đích
    amount: "0",
    slippage: 10,
    isBuyMode: true,
    platformWallet: "0x45C06f7aca34d031d799c446013aaa7A3E5F5D98",
    walletAddress: "",
    privateKey: "",
    useBrowserWallet: true,
    loading: false,
    transactionHash: "",
    errorMessage: "",
    balance: "0", // Số dư token để dùng khi bán
    wethBalance: "0", // Balance of WETH
    ethBalance: "0", // Balance of ETH
  });

  const [wallet, setWallet] = useState(null);

  // Kết nối ví
  const connectWallet = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const address = accounts[0];
        setState(prevState => ({ ...prevState, walletAddress: address }));
        localStorage.setItem("mys:liquidfun-connectedWalletAddress", address);
        await fetchTokenBalance(address); // Lấy lại số dư sau khi kết nối
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        setState(prevState => ({ ...prevState, errorMessage: "Failed to connect wallet" }));
      }
    } else {
      setState(prevState => ({ ...prevState, errorMessage: "Wallet address not found. Please install MetaMask." }));
    }
  }, []);

  const fetchWETHBalance = useCallback(async (address) => {
    if (address && chainsConfig[state.chainId]?.tokens.WETH) {
      try {
        const provider = getProvider();
        const wethContract = new ethers.Contract(
          chainsConfig[state.chainId].tokens.WETH,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const [balance, ethBalance] = await Promise.all([await wethContract.balanceOf(address), provider.getBalance(address)]);
        setState(prevState => ({
          ...prevState,
          wethBalance: ethers.formatEther(balance),
          ethBalance: ethers.formatEther(ethBalance)
        }));
      } catch (error) {
        console.error("Lỗi khi lấy số dư WETH:", error);
      }
    }
  }, [state.chainId]);

  const unswapToETH = useCallback(async () => {
    if (!state.walletAddress || !chainsConfig[state.chainId]?.tokens.WETH) {
      setState(prevState => ({ ...prevState, errorMessage: "Please connect your wallet and select a valid chain." }));
      return;
    }

    try {
      setState(prevState => ({ ...prevState, loading: true, errorMessage: "" }));

      let signer;
      const provider = new ethers.JsonRpcProvider(chainsConfig[state.chainId]?.rpcUrl);

      if (state.useBrowserWallet && typeof window !== "undefined" && window.ethereum) {
        // Use the browser wallet
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await browserProvider.getSigner();
      } else if (state.privateKey) {
        // Use private key for signing
        const wallet = new ethers.Wallet(state.privateKey, provider);
        signer = wallet.connect(provider);
      } else {
        throw new Error("Không tìm thấy phương thức kết nối ví hợp lệ.");
      }

      const wethContract = new ethers.Contract(
        chainsConfig[state.chainId].tokens.WETH,
        ["function withdraw(uint256 amount)"],
        signer
      );

      const balanceInWei = ethers.parseEther(state.wethBalance);
      const transaction = await wethContract.withdraw(balanceInWei);
      await transaction.wait();
      const ethBalance = ethers.formatEther(await provider.getBalance(state.walletAddress));
      setState(prevState => ({
        ...prevState,
        transactionHash: transaction.hash,
        wethBalance: "0", // Reset WETH balance after unswapping
        ethBalance: ethBalance
      }));
      console.log("Giao dịch thành công:", transaction.hash);
    } catch (error) {
      console.error("Lỗi khi unswap WETH về ETH:", error);
      setState(prevState => ({ ...prevState, errorMessage: "Error unswapping WETH to ETH." }));
    } finally {
      setState(prevState => ({ ...prevState, loading: false }));
    }
  }, [state.walletAddress, state.wethBalance, state.ethBalance, state.chainId, state.useBrowserWallet, state.privateKey]);

  useEffect(() => {
    if (state.walletAddress) {
      fetchWETHBalance(state.walletAddress);
    }
  }, [state.walletAddress, state.chainId, fetchWETHBalance]);

  // Ngắt kết nối ví
  const disconnectWallet = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      walletAddress: "",
      balance: "0",
      amount: "0"
    }));
    localStorage.removeItem("mys:liquidfun-connectedWalletAddress");
  }, []);

  const getProvider = useCallback(() => {
    const rpcUrl = chainsConfig[state.chainId]?.rpcUrl;
    return new ethers.JsonRpcProvider(rpcUrl);
  }, [state.chainId]);

  const fetchBuyLimit = useCallback(async () => {
    if (state.isBuyMode && state.destToken) {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(state.destToken, ["function BUY_LIMIT() view returns (uint256)"], provider);
        const limit = await contract.BUY_LIMIT();
        setState(prevState => ({ ...prevState, amount: limit.toString() }));
      } catch (error) {
        console.error("Lỗi khi lấy BUY_LIMIT:", error);
        setState(prevState => ({ ...prevState, amount: "0" }));
      }
    }
  }, [state.destToken, state.isBuyMode, getProvider]);
  useEffect(() => {
    if (state.isBuyMode && state.platform === "liquidfun") fetchBuyLimit();
  }, [state.destToken, state.srcToken, state.isBuyMode, fetchBuyLimit]);
  // Lấy lại số dư token của người dùng
  const fetchTokenBalance = useCallback(async (address) => {
    if (!address || !state.srcToken) return;
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(state.srcToken, ["function balanceOf(address) view returns (uint256)"], provider);
      const balance = await contract.balanceOf(address);

      setState(prevState => ({
        ...prevState,
        balance: balance,
        amount: !prevState.isBuyMode ? balance : prevState.amount // Auto fill amount in Sell Mode
      }));
    } catch (error) {
      console.error("Lỗi khi lấy số dư token:", error);
      setState(prevState => ({ ...prevState, balance: "0", errorMessage: "Error fetching token balance" }));
    }
  }, [state.srcToken, state.chainId]);

  const initializeWallet = useCallback(async () => {
    try {
      const provider = getProvider();
      let selectedWallet;

      if (state.useBrowserWallet && typeof window !== "undefined" && window.ethereum) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        selectedWallet = await browserProvider.getSigner();
        await connectWallet(); // Kết nối MetaMask nếu dùng ví trình duyệt
      } else if (state.privateKey) {
        selectedWallet = new ethers.Wallet(state.privateKey, provider);
      } else {
        setState(prevState => ({ ...prevState, errorMessage: "No valid wallet connection method found." }));
        return;
      }
      setWallet(selectedWallet);
    } catch (error) {
      console.error("Failed to initialize wallet:", error);
      setState(prevState => ({ ...prevState, errorMessage: "Failed to initialize wallet" }));
    }
  }, [state.useBrowserWallet, state.privateKey, state.chainId, connectWallet]);

  useEffect(() => {
    initializeWallet();
  }, [initializeWallet]);

  useEffect(() => {
    if (state.walletAddress && !state.isBuyMode) {
      fetchTokenBalance(state.walletAddress); // Lấy số dư khi ở chế độ bán
    }
  }, [state.walletAddress, state.isBuyMode, fetchTokenBalance]);

  const togglePlatform = (platform) => {
    setState(prevState => ({ ...prevState, platform }));
  };

  const toggleMode = () => {
    setState(prevState => ({
      ...prevState,
      isBuyMode: !prevState.isBuyMode,
      srcToken: prevState.destToken,
      destToken: prevState.srcToken,
      amount: !prevState.isBuyMode ? "0" : prevState.balance // Reset amount if switching to Buy Mode
    }));
  };

  const handlePercentageClick = (percentage) => {
    const amount = (BigInt(state.balance) * BigInt(percentage) / 100n).toString();
    setState(prevState => ({ ...prevState, amount: amount }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 p-10 flex justify-center items-center">
      <div className="w-full max-w-xl bg-white p-6 rounded-xl shadow-lg shadow-gray-400/30">
        <h1 className="text-3xl font-semibold text-center mb-6 text-gray-800">
          {state.isBuyMode ? "Buy Token" : "Sell Token"}
        </h1>

        {state.walletAddress ? (
          <>
            <p className="mb-4 text-center font-medium text-gray-700 overflow-hidden whitespace-nowrap text-ellipsis">
              Wallet connected: <a href={`${chainsConfig[state.chainId]?.scanUrl}/address/${state.walletAddress}`} target="_blank" rel="noopener noreferrer" className="underline">{state.walletAddress}</a>
            </p>
            <p className="mb-4 text-center font-medium text-gray-700 overflow-hidden whitespace-nowrap text-ellipsis">
              Balance: {state.ethBalance} ETH
            </p>
            <button
              onClick={disconnectWallet}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition mb-4"
            >
              Disconnect Wallet
            </button>
            {parseFloat(state.wethBalance) > 0 && (
              <button
                onClick={unswapToETH}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 rounded-lg transition mb-4"
                disabled={state.loading}
              >
                {state.loading ? "Unswapping..." : `Unswap ${state.wethBalance} WETH to ETH`}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={connectWallet}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition mb-4"
          >
            Connect Wallet
          </button>
        )}

        {/* Chọn nền tảng */}
        <div className="flex justify-center mb-6">
          <label className="mr-4 cursor-pointer">
            <input
              type="radio"
              name="platform"
              value="liquidfun"
              checked={state.platform === "liquidfun"}
              onChange={() => togglePlatform("liquidfun")}
              className="mr-2"
            />
            LiquidFun
          </label>
          <label className="mr-4 cursor-pointer">
            <input
              type="radio"
              name="platform"
              value="wow"
              checked={state.platform === "wow"}
              onChange={() => togglePlatform("wow")}
              className="mr-2"
            />
            Wow.XYZ
          </label>
          <label className="cursor-pointer">
            <input
              type="radio"
              name="platform"
              value="moonx"
              checked={state.platform === "moonx"}
              onChange={() => togglePlatform("moonx")}
              className="mr-2"
            />
            MoonX Farm
          </label>
        </div>

        {/* Chọn token gốc với combo box */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">From Token</label>
          {state.isBuyMode ? (
            <select
              value={state.srcToken}
              onChange={(e) => setState(prevState => ({ ...prevState, srcToken: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(chainsConfig[state.chainId].tokens).map(([tokenName, tokenAddress]) => (
                <option key={tokenName} value={tokenAddress}>{tokenName}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={state.srcToken}
              onChange={(e) => setState(prevState => ({ ...prevState, srcToken: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* Icon chuyển đổi chế độ */}
        <div className="flex items-center justify-center mb-6">
          <button
            onClick={toggleMode}
            className="bg-gray-200 hover:bg-gray-300 p-3 rounded-full transition text-gray-600"
            title="Swap to sell/buy mode"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ color: "rgb(34, 34, 34)", width: "24px", height: "24px", transform: "rotate(0deg)" }}>
              <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 12L12 19L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Chọn token đích với combo box */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">To Token</label>
          {!state.isBuyMode ? (
            <select
              value={state.destToken}
              onChange={(e) => setState(prevState => ({ ...prevState, destToken: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(chainsConfig[state.chainId].tokens).map(([tokenName, tokenAddress]) => (
                <option key={tokenName} value={tokenAddress}>{tokenName}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={state.destToken}
              onChange={(e) => setState(prevState => ({ ...prevState, destToken: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* Nhập Amount */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">Amount</label>
          <input
            type="text"
            value={state.amount}
            onChange={(e) => setState(prevState => ({ ...prevState, amount: e.target.value }))}
            className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {!state.isBuyMode && (
          <div className="flex justify-between mb-4 text-gray-600">
            {["24%", "42%", "69%", "100%"].map((percentage, idx) => (
              <button
                key={idx}
                onClick={() => handlePercentageClick(parseInt(percentage))}
                className="bg-gray-100 px-4 py-2 rounded-lg transition hover:bg-gray-200"
              >
                {percentage}
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center mb-4 cursor-pointer text-gray-600">
          <input
            type="checkbox"
            checked={state.useBrowserWallet}
            onChange={(e) => setState(prevState => ({ ...prevState, useBrowserWallet: e.target.checked }))}
            className="mr-2 accent-blue-500"
          />
          <span className="font-medium">Use Browser Wallet (MetaMask)</span>
        </label>

        {!state.useBrowserWallet && (
          <div className="mb-4">
            <label className="block mb-1 font-medium text-gray-600">Private key</label>
            <input
              type="password"
              value={state.privateKey}
              onChange={(e) => setState(prevState => ({ ...prevState, privateKey: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Nhập Slippage */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">Slippage</label>
          <input
            type="range"
            min="0"
            max="100"
            value={state.slippage}
            onChange={(e) => setState(prevState => ({ ...prevState, slippage: parseInt(e.target.value) }))}
            className="w-full"
          />
          <div className="text-center text-gray-700">{state.slippage}%</div>
        </div>

        {/* Giao diện theo nền tảng */}
        {state.platform === "liquidfun" ? (
          <LiquidFunPlatform
            isBuyMode={state.isBuyMode}
            wallet={wallet}
            amount={state.amount}
            platformWallet={state.platformWallet}
            srcToken={state.srcToken}
            destToken={state.destToken}
            chainId={state.chainId}
            slippage={state.slippage}
            handleTransactionComplete={(hash) => setState(prevState => ({ ...prevState, transactionHash: hash }))}
          />
        ) : state.platform === "wow" ? (
          <WowPlatform
            rpcUrl={chainsConfig[state.chainId]?.rpcUrl}
            isBuyMode={state.isBuyMode}
            wallet={wallet}
            contractAddress={state.isBuyMode ? state.destToken : state.srcToken}
            amount={state.amount}
            useBrowserWallet={state.useBrowserWallet}
            handleTransactionComplete={(hash) => setState(prevState => ({ ...prevState, transactionHash: hash }))}
          />
        ) : (
          <MoonXPlatform
            rpcUrl={chainsConfig[state.chainId]?.rpcUrl}
            isBuyMode={state.isBuyMode}
            wallet={wallet}
            tokenAdress={state.isBuyMode ? state.destToken : state.srcToken}
            slippage={state.slippage}
            amount={state.amount}
            useBrowserWallet={state.useBrowserWallet}
            handleTransactionComplete={(hash) => setState(prevState => ({ ...prevState, transactionHash: hash }))}
          />
        )}

        {/* Thông báo giao dịch */}
        {state.transactionHash && (
          <p className="mt-4 text-center font-bold text-green-500 overflow-hidden whitespace-nowrap text-ellipsis">
            Transaction successful. Tx: <a href={`${chainsConfig[state.chainId]?.scanUrl}/tx/${state.transactionHash}`} target="_blank" rel="noopener noreferrer" className="underline">{state.transactionHash}</a>
          </p>
        )}

        {/* Thông báo lỗi */}
        {state.errorMessage && (
          <p className="mt-4 text-center font-bold text-red-500">
            Error: {state.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
