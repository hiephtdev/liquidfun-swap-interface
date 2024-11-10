import { Button, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import LiquidFunPlatform from "./LiquidFunPlatform";
import WowPlatform from "./WowPlatform";
import MoonXPlatform from "./MoonXPlatform";
import { chainsConfig } from "@/constants/common";
import { useRouter } from 'next/router';
import FarcasterShareIcon from "@/components/icons/FarcasterShareIcon";

export default function Home() {
  const router = useRouter();

  const [state, setState] = useState({
    chainId: "8453",
    platform: "wow",
    srcToken: "", // Token gốc
    destToken: "", // Token đích
    amount: "0",
    slippage: 3,
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
    purchasedTokens: [], // Load initially from localStorage
    symbolSuggestion: null,
    extraGasForMiner: false, // Thêm state mới
    ref: ethers.ZeroAddress
  });

  // Kiểm tra và lấy refParam khi có
  useEffect(() => {
    const fetchRefParam = async () => {
      if (state.walletAddress) {
        // Gọi API để lấy refParam từ db
        const response = await fetch(`/api/get-ref?walletAddress=${state.walletAddress}`);
        const data = await response.json();
        if (data.refParam) {
          setState((prevState) => ({ ...prevState, ref: data.refParam }));
          return;
        }
      }
      if (router.query.ref) {
        // Nếu có `ref` trong URL thì lấy từ URL
        setState((prevState) => ({ ...prevState, ref: router.query.ref }));
      } else {
        setState((prevState) => ({ ...prevState, ref: ethers.ZeroAddress })); // Set mặc định
      }
    };
    fetchRefParam();
  }, [router.query, state.walletAddress]);

  // Generate referral link
  const referralLink = `https://fun.moonx.farm/?ref=${state.walletAddress}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      alert('Referral link copied to clipboard!');
    });
  };

  const handleShareOnX = () => {
    const shareUrl = `https://x.com/intent/post?text=%F0%9F%9A%80+Trade+Fast+%26+Secure+on+MoonXFarm%21+%F0%9F%90%82%F0%9F%92%B0%0A%0AConnect+your+wallet+to+trade+tokens+on+%40liquiddotfun%2C+%40wow+%26+Uniswap.%0A%0AGet+real-time+deals+%26+updates%21%0A%0A%F0%9F%91%89+Sign+up%3A+${encodeURIComponent(referralLink)}%0A%0A%23Crypto+%23TokenTrading+%23DeFi+%23MoonXFarm`;
    window.open(shareUrl, '_blank');
  };

  const handleShareOnWarpcast = () => {
    const shareUrl = `https://warpcast.com/~/compose?text=%F0%9F%9A%80+Trade+Fast+%26+Secure+on+MoonXFarm%21+%F0%9F%90%82%F0%9F%92%B0%0A%0AConnect+your+wallet+to+trade+tokens+on+%40liquiddotfun%2C+%40wow+%26+Uniswap.%0A%0AGet+real-time+deals+%26+updates%21%0A%0A%F0%9F%91%89+Sign+up%3A+${encodeURIComponent(referralLink)}%0A%0A%23Crypto+%23TokenTrading+%23DeFi+%23MoonXFarm`;
    window.open(shareUrl, '_blank');
  };

  const [showSuggestions, setShowSuggestions] = useState(false);
  // Load purchased tokens from localStorage on the client side
  useEffect(() => {
    if (typeof window !== "undefined") { // Ensure we're on the client
      const storedTokens = JSON.parse(localStorage.getItem(`mys:${state.platform}-purchasedTokens`)) || [];
      setState((prevState) => ({ ...prevState, purchasedTokens: storedTokens }));
    }
  }, [state.platform]);

  const addTokenToStorage = async (tokenAddress) => {
    try {
      if (state.purchasedTokens.find(token => token.address === tokenAddress)) return;
      const provider = getProvider();
      const contract = new ethers.Contract(
        tokenAddress,
        ["function symbol() view returns (string)"],
        provider
      );
      const symbol = await contract.symbol();
      const newToken = { address: tokenAddress, symbol };
      const updatedTokens = [...state.purchasedTokens, newToken];
      localStorage.setItem(`mys:${state.platform}-purchasedTokens`, JSON.stringify(updatedTokens));
      setState((prevState) => ({ ...prevState, purchasedTokens: updatedTokens }));
    } catch (error) {
      console.error("Error fetching token symbol:", error);
      setState((prevState) => ({ ...prevState, errorMessage: "Failed to add token" }));
    }
  };

  const fetchTokenSymbol = async (tokenAddress) => {
    const isAlreadyStored = state.purchasedTokens.find(token => token.address === tokenAddress);
    if (isAlreadyStored) {
      setState(prevState => ({ ...prevState, symbolSuggestion: isAlreadyStored.symbol }));
      return;
    }

    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        tokenAddress,
        ["function symbol() view returns (string)"],
        provider
      );
      const symbol = await contract.symbol();
      setState(prevState => ({ ...prevState, symbolSuggestion: symbol, errorMessage: "" }));
    } catch {
      setState(prevState => ({ ...prevState, symbolSuggestion: "Not found", errorMessage: "" }));
    }
  };

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

        // Lưu `refParam` vào db khi có refParam
        if (state.ref !== ethers.ZeroAddress && ethers.isAddress(state.ref)) {
          await fetch("/api/save-ref", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, refParam: state.ref }),
          });
        }
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        setState(prevState => ({ ...prevState, errorMessage: "Failed to connect wallet" }));
      }
    } else {
      setState(prevState => ({ ...prevState, errorMessage: "Wallet address not found. Please install MetaMask." }));
    }
  }, [state.ref]);

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
    if (!state.destToken || !ethers.isAddress(state.destToken)) return;
    if (state.isBuyMode && state.destToken) {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(ethers.getAddress(state.destToken), ["function BUY_LIMIT() view returns (uint256)"], provider);
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
    if (!address || !state.srcToken || !ethers.isAddress(state.srcToken)) return;
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(ethers.getAddress(state.srcToken), ["function balanceOf(address) view returns (uint256)"], provider);
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

  const handleChainSwitch = useCallback(async () => {
    if (typeof window !== "undefined" && state.useBrowserWallet && window.ethereum) {
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (currentChainId !== `0x${parseInt(state.chainId, 10).toString(16)}`) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${parseInt(state.chainId, 10).toString(16)}` }]
          });
        } catch (error) {
          setState(prevState => ({
            ...prevState,
            errorMessage: error.code === 4902 ? "The chain has not been added to MetaMask. Please add the chain manually." : "Error switching chains."
          }));
          return false;
        }
      }
    }
    return true;
  }, [state.chainId, state.useBrowserWallet]);

  // Hàm kiểm tra tính hợp lệ của Private Key
  const isValidPrivateKey = (key) => {
    // Kiểm tra nếu có tiền tố "0x", chiều dài phải là 66, nếu không thì là 64
    const regex = /^(0x)?[0-9a-fA-F]{64}$/;
    return regex.test(key);
  };

  const initializeWallet = useCallback(async () => {
    try {
      if (!state.privateKey || !isValidPrivateKey(state.privateKey)) return;
      console.log("Initializing wallet...");
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

  // Hàm để định dạng địa chỉ ví
  const formatWalletAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-5)}`;
  };

  useEffect(() => {
    const autoConnectWallet = async () => {
      if (typeof window !== "undefined" && window.ethereum && state.useBrowserWallet) {
        const savedAddress = localStorage.getItem("mys:liquidfun-connectedWalletAddress");
        if (savedAddress) {
          // Lưu `refParam` vào db khi có refParam
          if (state.ref !== ethers.ZeroAddress && ethers.isAddress(state.ref)) {
            await fetch("/api/save-ref", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ walletAddress: savedAddress, refParam: state.ref }),
            });
          }
          setState((prevState) => ({ ...prevState, walletAddress: savedAddress }));
          await fetchTokenBalance(savedAddress);
          await fetchWETHBalance(savedAddress);
        } else {
          await connectWallet(); // Automatically connect if no address is saved
        }
      }
    };

    autoConnectWallet();
  }, [state.useBrowserWallet, connectWallet, fetchTokenBalance, fetchWETHBalance]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 p-10 flex justify-center items-center">
        <div className="w-full max-w-xl bg-white p-6 rounded-xl shadow-lg shadow-gray-400/30 relative">
          {/* Thêm logo ở đầu giao diện */}
          <div className="flex justify-center items-center mb-2 space-x-4">
            <img src="/default_logo.png" alt="Logo" className="h-16 w-auto" />
            <h1 className="text-3xl font-semibold text-gray-800">
              {state.isBuyMode ? "Buy Token" : "Sell Token"}
            </h1>
          </div>
          <Popover className="text-center mb-4">
            <PopoverButton className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition focus:border-none focus:outline-none"
              onClick={(e) => {
                if (!state.walletAddress) {
                  e.preventDefault(); // Ngăn PopoverPanel mở ra khi chưa kết nối
                  connectWallet();
                }
              }}>
              {state.walletAddress ? `${formatWalletAddress(state.walletAddress)} - ${Number.parseFloat(state.ethBalance).toFixed(6)} ETH` : "Connect Wallet"}
            </PopoverButton>

            <PopoverPanel anchor="bottom end" className="absolute z-10 mt-2 w-64 bg-white shadow-lg rounded-lg p-4 border border-gray-200">
              {state.walletAddress && (
                <>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Connected Wallet:
                  </p>
                  <p className="text-xs text-gray-500 mb-4 overflow-hidden whitespace-nowrap text-ellipsis">
                    <a href={`${chainsConfig[state.chainId]?.scanUrl}/address/${state.walletAddress}`} target="_blank" rel="noopener noreferrer" className="underline">{state.walletAddress}</a>
                  </p>
                  <p className="text-sm font-bold text-gray-700 mb-2">
                    Balance: {Number.parseFloat(state.ethBalance).toFixed(6)} ETH
                  </p>
                  <button
                    onClick={disconnectWallet}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition"
                  >
                    Disconnect Wallet
                  </button>
                </>
              )}
            </PopoverPanel>
          </Popover>


          {parseFloat(state.wethBalance) > 0 && (
            <button
              onClick={unswapToETH}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 rounded-lg transition mb-4"
              disabled={state.loading}
            >
              {state.loading ? "Unswapping..." : `Unswap ${state.wethBalance} WETH to ETH`}
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
                className="w-full p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(chainsConfig[state.chainId].tokens).map(([tokenName, tokenAddress]) => (
                  <option key={tokenName} value={tokenAddress} className="text-black">{tokenName}</option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="text"
                  value={state.srcToken}
                  onChange={(e) => {
                    const tokenAddress = e.target.value;
                    setState(prevState => ({ ...prevState, srcToken: tokenAddress }));
                    if (tokenAddress.length === 42) {
                      fetchTokenSymbol(tokenAddress);
                    } else {
                      setState(prevState => ({ ...prevState, symbolSuggestion: null }));
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full p-3 bg-gray-50 rounded-lg text-black  border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type or select token to sell"
                />
                {showSuggestions && (state.purchasedTokens.length > 0 || state.symbolSuggestion) && (
                  <ul className="absolute w-full max-w-lg bg-white border border-gray-300 rounded-lg mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
                    {state.symbolSuggestion ? (
                      state.symbolSuggestion !== "Not found" ? (
                        <li
                          onMouseDown={() => {
                            setState(prevState => ({ ...prevState, srcToken: state.srcToken, symbolSuggestion: null }));
                          }}
                          className="p-2 cursor-pointer hover:bg-gray-100 text-black"
                        >
                          {state.symbolSuggestion ? `${state.symbolSuggestion} (${state.srcToken})` : "Not found"}
                        </li>
                      ) : (
                        <li className="p-2 text-red-500">Not found</li>
                      )
                    ) : (
                      state.purchasedTokens.map((token, index) => (
                        <li
                          key={index}
                          onMouseDown={() => setState(prevState => ({ ...prevState, srcToken: token.address }))}
                          className="p-2 cursor-pointer hover:bg-gray-100"
                        >
                          {token.symbol ? `${token.symbol} (${token.address})` : "Not found"}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </>
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
                className="w-full p-3 bg-gray-50 rounded-lg border text-black border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(chainsConfig[state.chainId].tokens).map(([tokenName, tokenAddress]) => (
                  <option key={tokenName} value={tokenAddress} className="text-black">{tokenName}</option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="text"
                  value={state.destToken}
                  onChange={(e) => {
                    const tokenAddress = e.target.value;
                    setState(prevState => ({ ...prevState, destToken: tokenAddress }));
                    if (tokenAddress.length === 42) {
                      fetchTokenSymbol(tokenAddress);
                    } else {
                      setState(prevState => ({ ...prevState, symbolSuggestion: null }));
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type or select token to sell"
                />
                {showSuggestions && (state.purchasedTokens.length > 0 || state.symbolSuggestion) && (
                  <ul className="absolute w-full max-w-lg bg-white border border-gray-300 rounded-lg mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
                    {state.symbolSuggestion ? (
                      state.symbolSuggestion !== "Not found" ? (
                        <li
                          onMouseDown={() => {
                            setState(prevState => ({ ...prevState, destToken: state.destToken, symbolSuggestion: null }));
                          }}
                          className="p-2 cursor-pointer hover:bg-gray-100 text-black"
                        >
                          {state.symbolSuggestion ? `${state.symbolSuggestion} (${state.destToken})` : "Not found"}
                        </li>
                      ) : (
                        <li className="p-2 text-red-500">Not found</li>
                      )
                    ) : (
                      state.purchasedTokens.map((token, index) => (
                        <li
                          key={index}
                          onMouseDown={() => setState(prevState => ({ ...prevState, destToken: token.address }))}
                          className="p-2 cursor-pointer hover:bg-gray-100"
                        >
                          {token.symbol ? `${token.symbol} (${token.address})` : "Not found"}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Nhập Amount */}
          <div className="mb-4">
            <label className="block mb-1 font-medium text-gray-600">Amount</label>
            <input
              type="text"
              value={state.amount}
              onChange={(e) => setState(prevState => ({ ...prevState, amount: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!state.isBuyMode && (
            <div className="flex justify-between mb-4 text-gray-600">
              {["24%", "42%", "69%", "100%"].map((percentage, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePercentageClick(parseInt(percentage))}
                  className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg transition hover:bg-gray-200"
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
                className="w-full p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Checkbox để chọn trả thêm phí gas cho miner */}
          {!state.useBrowserWallet && (
            <label className="flex items-center mb-4 cursor-pointer text-gray-600">
              <input
                type="checkbox"
                checked={state.extraGasForMiner}
                onChange={(e) => setState(prevState => ({ ...prevState, extraGasForMiner: e.target.checked }))}
                className="mr-2 accent-blue-500"
              />
              <span className="font-medium">Pay additional gas fee for Miner</span>
            </label>
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
              handleChainSwitch={handleChainSwitch}
              loadBalance={(address) => fetchWETHBalance(address)}
              handleTransactionComplete={(hash) => setState(prevState => ({ ...prevState, transactionHash: hash }))}
              addTokenToStorage={(address) => addTokenToStorage(address)}
            />
          ) : state.platform === "wow" ? (
            <WowPlatform
              rpcUrl={chainsConfig[state.chainId]?.rpcUrl}
              isBuyMode={state.isBuyMode}
              wallet={wallet}
              contractAddress={state.isBuyMode ? state.destToken : state.srcToken}
              amount={state.amount}
              useBrowserWallet={state.useBrowserWallet}
              loadBalance={(address) => fetchWETHBalance(address)}
              handleChainSwitch={handleChainSwitch}
              extraGasForMiner={state.extraGasForMiner}
              handleTransactionComplete={(hash) => setState(prevState => ({ ...prevState, transactionHash: hash }))}
              addTokenToStorage={(address) => addTokenToStorage(address)}
            />
          ) : (
            <MoonXPlatform
              chainId={state.chainId}
              rpcUrl={chainsConfig[state.chainId]?.rpcUrl}
              isBuyMode={state.isBuyMode}
              wallet={wallet}
              tokenAdress={state.isBuyMode ? state.destToken : state.srcToken}
              slippage={state.slippage}
              amount={state.amount}
              useBrowserWallet={state.useBrowserWallet}
              handleChainSwitch={handleChainSwitch}
              loadBalance={(address) => fetchWETHBalance(address)}
              extraGasForMiner={state.extraGasForMiner}
              handleTransactionComplete={(hash) => setState(prevState => ({ ...prevState, transactionHash: hash }))}
              addTokenToStorage={(address) => addTokenToStorage(address)}
              ref={state.ref}
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

          {/* Display referral link with copy and share buttons */}
          {state.walletAddress && (
            <div className="flex justify-between items-center text-gray-800 mt-5">
              <div className="flex items-center space-x-2">
                <button onClick={() => { window.open("https://x.com/MoonXFarm", '_blank'); }}>
                  <i className="fab fa-twitter text-blue-500"></i>
                </button>
                <button onClick={() => { window.open("https://discord.gg/x9f4vkvu", '_blank'); }}>
                  <i className="fab fa-discord text-indigo-600"></i>
                </button>
                <button onClick={() => { window.open("https://t.me/MoonXFarm", '_blank'); }}>
                  <i className="fab fa-telegram text-blue-400"></i>
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <span>Share your link ref</span>
                <button onClick={handleCopyLink}>
                  <i className="fas fa-copy cursor-pointer text-gray-500 hover:text-blue-700"></i>
                </button>
                <button onClick={handleShareOnX}>
                  <i className="fab fa-twitter text-blue-500"></i>
                </button>
                <button onClick={handleShareOnWarpcast}>
                  <FarcasterShareIcon className="text-[#8660cd]" />
                </button>
              </div>
            </div>

            // <div className="mt-4 text-center">
            //   <p className="text-gray-600 text-sm">Your referral link:</p>
            //   <div className="flex items-center justify-center space-x-2">
            //     <input
            //       type="text"
            //       readOnly
            //       value={referralLink}
            //       className="border border-gray-300 rounded px-2 py-1 text-gray-700 text-sm"
            //       style={{ width: "80%" }}
            //     />
            //     <button onClick={handleCopyLink} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded">
            //       Copy
            //     </button>
            //     <button onClick={handleShareOnX} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded">
            //       Share on X
            //     </button>
            //   </div>
            // </div>
          )}
        </div>
      </div>
    </>
  );
}
