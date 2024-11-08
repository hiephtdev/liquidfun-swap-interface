import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { chainsConfig } from "@/constants/common";

export default function Home() {
  const [state, setState] = useState({
    chainId: "8453",
    srcToken: "",
    destAmount: "0",
    platformWallet: "0x45C06f7aca34d031d799c446013aaa7A3E5F5D98",
    destToken: "",
    privateKey: "",
    useBrowserWallet: true,
    loading: false,
    transactionHash: "",
    errorMessage: "",
    isBuyMode: true,
    walletAddress: "",
    amount: "",
    balance: "0", // Add balance to state
    wethBalance: "0", // Balance of WETH
    slippage: 10, // Default slippage set to 10%
    swapAmount: "0",
    purchasedTokens: [] // Load initially from localStorage
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  // Load purchased tokens from localStorage on the client side
  useEffect(() => {
    if (typeof window !== "undefined") { // Ensure we're on the client
      const storedTokens = JSON.parse(localStorage.getItem("mys:liquidfun-purchasedTokens")) || [];
      setState((prevState) => ({ ...prevState, purchasedTokens: storedTokens }));
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const address = accounts[0];
        setState(prevState => ({ ...prevState, walletAddress: address }));
        localStorage.setItem("mys:liquidfun-connectedWalletAddress", address);
        await fetchWETHBalance(address); // Load WETH balance after connecting
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        setState(prevState => ({ ...prevState, errorMessage: "Failed to connect wallet" }));
      }
    } else {
      setState(prevState => ({ ...prevState, errorMessage: "Wallet address not found. Please install MetaMask." }));
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      walletAddress: "",
      balance: "0",
      destAmount: "0"
    }));
    localStorage.removeItem("mys:liquidfun-connectedWalletAddress");
  }, []);

  const addTokenToStorage = (tokenAddress) => {
    const updatedTokens = [...state.purchasedTokens, tokenAddress];
    localStorage.setItem("mys:liquidfun-purchasedTokens", JSON.stringify(updatedTokens));
    setState((prevState) => ({ ...prevState, purchasedTokens: updatedTokens }));
  };

  const removeTokenFromStorage = (tokenAddress) => {
    const updatedTokens = state.purchasedTokens.filter((address) => address !== tokenAddress);
    localStorage.setItem("mys:liquidfun-purchasedTokens", JSON.stringify(updatedTokens));
    setState((prevState) => ({ ...prevState, purchasedTokens: updatedTokens }));
  };

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

  useEffect(() => {
    const savedAddress = localStorage.getItem("mys:liquidfun-connectedWalletAddress");
    if (savedAddress) {
      setState(prevState => ({ ...prevState, walletAddress: savedAddress }));
    } else {
      connectWallet();
    }
  }, [connectWallet]);

  useEffect(() => {
    if (state.isBuyMode) {
      // In buy mode, update srcToken based on the selected chain
      setState(prevState => ({
        ...prevState,
        srcToken: chainsConfig[state.chainId]?.tokens.WETH || ""
      }));
    } else {
      // In sell mode, update destToken based on the selected chain
      setState(prevState => ({
        ...prevState,
        destToken: chainsConfig[state.chainId]?.tokens.WETH || ""
      }));
    }
  }, [state.chainId, state.isBuyMode]);

  const toggleMode = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      isBuyMode: !prevState.isBuyMode,
      srcToken: prevState.destToken,
      destToken: prevState.srcToken
    }));
  }, [state.destToken, state.srcToken]);

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
        setState(prevState => ({ ...prevState, destAmount: limit.toString() }));
      } catch (error) {
        console.error("Lỗi khi lấy BUY_LIMIT:", error);
        setState(prevState => ({ ...prevState, destAmount: "0" }));
      }
    }
  }, [state.destToken, state.isBuyMode, getProvider]);

  const fetchTokenBalance = useCallback(async () => {
    if (!state.walletAddress) {
      connectWallet();
      return;
    }

    if (!state.srcToken) {
      setState(prevState => ({ ...prevState, balance: "0", destAmount: "0" }));
      return;
    }

    if (state.srcToken === ethers.ZeroAddress) {
      setState(prevState => ({ ...prevState, balance: "0", destAmount: "0" }));
      return;
    }

    if (ethers.isAddress(state.srcToken) === false) {
      setState(prevState => ({ ...prevState, balance: "0", destAmount: "0" }));
      return;
    }

    try {
      const provider = getProvider();
      const contract = new ethers.Contract(state.srcToken, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint256)"], provider);
      const balance = await contract.balanceOf(state.walletAddress);
      setState(prevState => ({ ...prevState, balance: balance.toString(), destAmount: balance.toString() }));
    } catch (error) {
      console.error("Lỗi khi lấy số dư token:", error);
      setState(prevState => ({ ...prevState, balance: "0", destAmount: "0" }));
    }
  }, [state.srcToken, state.walletAddress, connectWallet, getProvider]);

  const fetchWETHBalance = useCallback(async (address) => {
    if (address && chainsConfig[state.chainId]?.tokens.WETH) {
      try {
        const provider = new ethers.JsonRpcProvider(chainsConfig[state.chainId]?.rpcUrl);
        const wethContract = new ethers.Contract(
          chainsConfig[state.chainId].tokens.WETH,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const balance = await wethContract.balanceOf(address);
        setState(prevState => ({
          ...prevState,
          wethBalance: ethers.formatEther(balance)
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

      setState(prevState => ({
        ...prevState,
        transactionHash: transaction.hash,
        wethBalance: "0" // Reset WETH balance after unswapping
      }));
      console.log("Giao dịch thành công:", transaction.hash);
    } catch (error) {
      console.error("Lỗi khi unswap WETH về ETH:", error);
      setState(prevState => ({ ...prevState, errorMessage: "Error unswapping WETH to ETH." }));
    } finally {
      setState(prevState => ({ ...prevState, loading: false }));
    }
  }, [state.walletAddress, state.wethBalance, state.chainId, state.useBrowserWallet, state.privateKey]);

  useEffect(() => {
    if (state.walletAddress) {
      fetchWETHBalance(state.walletAddress);
    }
  }, [state.walletAddress, state.chainId, fetchWETHBalance]);

  useEffect(() => {
    const fetchSwapAmount = async () => {
      if (!state.srcToken || !state.destToken || !state.walletAddress) return;

      try {
        const userAddress = state.walletAddress;
        const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${state.chainId}&src=${state.srcToken}&dest=${state.destToken}&${state.isBuyMode ? "destAmount" : "srcAmount"}=${state.destAmount}&platformWallet=${state.platformWallet}&userAddress=${userAddress}`;

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}`
          }
        });

        if (!response.ok) {
          console.error("API Error:", await response.text());
          return;
        }

        const responseData = await response.json();
        const { amount: ethAmount } = responseData.rates[0];
        const isWETH = [state.srcToken, state.destToken].includes(chainsConfig[state.chainId]?.tokens.WETH);
        let amount = "0";
        if (state.isBuyMode) {
          amount = ethers.formatUnits(`${BigInt(ethAmount) * BigInt(state.slippage) / 100n + BigInt(ethAmount)}`, isWETH ? 18 : 6);
        } else {
          amount = ethers.formatUnits(ethAmount, isWETH ? 18 : 6);
        }

        setState(prevState => ({ ...prevState, swapAmount: amount }));
      } catch (error) {
        console.error("Error fetching swap amount from API:", error);
        setState(prevState => ({ ...prevState, swapAmount: ethers.formatUnits(`0`, isWETH ? 18 : 6) }));
      }
    };

    fetchSwapAmount(); // Initial fetch
    const interval = setInterval(fetchSwapAmount, 30000); // Fetch every 30 seconds

    return () => clearInterval(interval); // Clear interval on unmount
  }, [state.srcToken, state.destToken, state.chainId, state.destAmount, state.isBuyMode, state.walletAddress]);

  const handleSwap = useCallback(async () => {
    if (!state.srcToken || (!state.useBrowserWallet && !state.privateKey)) {
      setState(prevState => ({ ...prevState, errorMessage: "Please enter all required information." }));
      return;
    }

    if (!state.destAmount || state.destAmount === "0" || isNaN(state.destAmount)) {
      setState(prevState => ({ ...prevState, errorMessage: "Please enter the token amount." }));
      return;
    }

    const chainSwitched = await handleChainSwitch();
    if (!chainSwitched) return;

    setState(prevState => ({ ...prevState, loading: true, amount: "", transactionHash: "", errorMessage: "" }));

    try {
      let provider = getProvider();
      let wallet;

      if (state.useBrowserWallet) {
        if (!window.ethereum) await connectWallet();
        provider = new ethers.BrowserProvider(window.ethereum);
        wallet = await provider.getSigner();
      } else {
        wallet = new ethers.Wallet(state.privateKey, provider);
      }

      const userAddress = wallet.address;
      const apiUrl = `https://api.liquid.fun/v1/swap/rate?chainId=${state.chainId}&src=${state.srcToken}&dest=${state.destToken}&${state.isBuyMode ? "destAmount" : "srcAmount"}=${state.destAmount}&platformWallet=${state.platformWallet}&userAddress=${userAddress}`;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ACCESS_TOKEN}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Lỗi API:", errorText);
        setState(prevState => ({ ...prevState, errorMessage: "API Error: " + errorText }));
        return;
      }

      const responseData = await response.json();
      const { data } = responseData.rates[0].txObject;
      const { amount: ethAmount } = responseData.rates[0];
      const isWETH = [state.srcToken, state.destToken].includes(chainsConfig[state.chainId]?.tokens.WETH);
      const txValue = isWETH && state.isBuyMode ? ethers.parseUnits(`${BigInt(ethAmount) * BigInt(state.slippage) / 100n + BigInt(ethAmount)}`, "wei") : 0n;
      const amount = ethers.formatUnits(ethAmount, isWETH ? 18 : 6);

      setState(prevState => ({
        ...prevState,
        amount: `${Number.parseFloat(amount).toFixed(6)} ${isWETH ? "ETH" : state.srcToken === chainsConfig[state.chainId]?.tokens.USDC ? "USDC" : "USDT"}`
      }));

      // Kiểm tra và duyệt token bán nếu cần
      if (state.srcToken !== ethers.ZeroAddress && !state.isBuyMode) {  // Tránh duyệt với ETH
        const tokenContract = new ethers.Contract(state.srcToken, ["function approve(address spender, uint256 amount)", "function allowance(address owner, address spender) view returns (uint256)"], wallet);
        const allowance = await tokenContract.allowance(userAddress, state.platformWallet);

        if (parseInt(allowance) < parseInt(state.destAmount)) {
          const approveTx = await tokenContract.approve(state.platformWallet, state.destAmount);  // Duyệt tối đa
          await approveTx.wait();
        }
      }

      if (state.isBuyMode && state.srcToken !== ethers.ZeroAddress && state.srcToken !== chainsConfig[state.chainId]?.tokens.WETH) {
        const tokenContract = new ethers.Contract(state.srcToken, ["function approve(address spender, uint256 amount)", "function allowance(address owner, address spender) view returns (uint256)"], wallet);
        const allowance = await tokenContract.allowance(userAddress, state.platformWallet);
        if (parseInt(allowance) < parseInt(ethAmount)) {
          const approveTx = await tokenContract.approve(state.platformWallet, ethAmount);
          await approveTx.wait();
        }
      }

      const maxTxValue = ethers.parseEther("0.003");
      if (state.isBuyMode && txValue > maxTxValue && !state.useBrowserWallet) {
        setState(prevState => ({ ...prevState, errorMessage: "The transaction amount exceeds the allowed limit." }));
        return;
      }

      // const tx = await multicallContract.multicall(dataWithoutSelector, { value: txValue });
      const tx = {
        to: state.platformWallet,
        data: data,
        value: txValue
      };

      const transaction = await wallet.sendTransaction(tx);

      // After a successful buy transaction, add the token to storage
      if (state.isBuyMode) {
        addTokenToStorage(state.destToken);
      } else {
        if (state.balance === state.destAmount) {
          removeTokenFromStorage(state.srcToken);
        }
      }
      // setTransactionHash(transaction.hash);
      // await tx.wait();
      setState(prevState => ({ ...prevState, transactionHash: transaction.hash }));
    } catch (error) {
      console.error("Lỗi khi thực hiện giao dịch:", error);
      setState(prevState => ({ ...prevState, errorMessage: "Transaction failed: " + (error.shortMessage || error.message) }));
    } finally {
      setState(prevState => ({ ...prevState, loading: false }));
    }
  }, [state, handleChainSwitch, connectWallet, getProvider]);

  useEffect(() => {
    if (state.isBuyMode) fetchBuyLimit();
    else fetchTokenBalance();
  }, [state.destToken, state.srcToken, state.isBuyMode, fetchBuyLimit, fetchTokenBalance]);

  const handlePercentageClick = (percentage) => {
    const amount = (BigInt(state.balance) * BigInt(percentage) / 100n).toString();
    setState(prevState => ({ ...prevState, destAmount: amount }));
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
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition"
          >
            Connect Wallet
          </button>
        )}

        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">Chain ID</label>
          <select
            value={state.chainId}
            onChange={(e) => setState(prevState => ({ ...prevState, chainId: e.target.value }))}
            className="w-full pl-2 pr-10 py-3 bg-gray-50 rounded-lg border border-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(chainsConfig).map(([id, config]) => (
              <option key={id} value={id} className="p-2 bg-white text-gray-700 hover:bg-gray-100">
                {config.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">From</label>
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
            // <input
            //   type="text"
            //   value={state.srcToken}
            //   onChange={(e) => setState(prevState => ({ ...prevState, srcToken: e.target.value }))}
            //   className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            // />
            <>
              <input
                type="text"
                value={state.srcToken}
                onChange={(e) => setState(prevState => ({ ...prevState, srcToken: e.target.value }))}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type or select token to sell"
              />
              {showSuggestions && state.purchasedTokens.length > 0 && (
                <ul className="absolute w-full max-w-lg bg-white border border-gray-300 rounded-lg mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
                  {state.purchasedTokens.map((tokenAddress, index) => (
                    <li
                      key={index}
                      onMouseDown={() => setState(prevState => ({ ...prevState, srcToken: tokenAddress }))}
                      className="p-2 cursor-pointer hover:bg-gray-100"
                    >
                      {tokenAddress}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
          }
        </div>

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

        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">To</label>
          {state.isBuyMode ? (
            <input
              type="text"
              value={state.destToken}
              onChange={(e) => setState(prevState => ({ ...prevState, destToken: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <select
              value={state.destToken}
              onChange={(e) => setState(prevState => ({ ...prevState, destToken: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(chainsConfig[state.chainId].tokens).map(([tokenName, tokenAddress]) => (
                <option key={tokenName} value={tokenAddress}>{tokenName}</option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">Amount</label>
          <input
            type="text"
            value={state.destAmount}
            onChange={(e) => setState(prevState => ({ ...prevState, destAmount: e.target.value }))}
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

        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">Slippage</label>
          <input
            type="range"
            min="0"
            max="200"
            value={state.slippage}
            onChange={(e) => setState(prevState => ({ ...prevState, slippage: parseInt(e.target.value) }))}
            className="w-full"
          />
          <div className="text-center text-gray-700">{state.slippage}%</div>
        </div>

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
        <div className={`mb-4 text-center ${state.isBuyMode ? "text-red-600" : "text-green-600"} italic font-semibold`}>
          {state.isBuyMode
            ? `Amount to pay: ${state.swapAmount} ${state.srcToken === chainsConfig[state.chainId]?.tokens.WETH ? "ETH" : state.srcToken === chainsConfig[state.chainId]?.tokens.USDC ? "USDC" : "USDT"}`
            : `Amount to receive: ${state.swapAmount} ${state.destToken === chainsConfig[state.chainId]?.tokens.WETH ? "ETH" : state.destToken === chainsConfig[state.chainId]?.tokens.USDC ? "USDC" : "USDT"}`}
        </div>
        <button
          onClick={handleSwap}
          disabled={state.loading}
          className={`w-full py-2 rounded-lg transition font-bold ${state.isBuyMode ? "bg-green-500 hover:bg-green-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
        >
          {state.loading ? `Swap${!state.isBuyMode ? ` ${state.amount}` : ``}...` : state.isBuyMode ? "Buy Token" : "Sell Token"}
        </button>

        {state.transactionHash && (
          <p className="mt-4 text-center font-bold text-green-500 overflow-hidden whitespace-nowrap text-ellipsis">
            Transaction successful. Tx: <a href={`${chainsConfig[state.chainId]?.scanUrl}/tx/${state.transactionHash}`} target="_blank" rel="noopener noreferrer" className="underline">{state.transactionHash}</a>
          </p>
        )}

        {state.errorMessage && (
          <p className="mt-4 text-center font-bold text-red-500">
            Error: {state.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}  