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
    balance: "0" // Add balance to state
  });


  const connectWallet = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const address = accounts[0];
        setState(prevState => ({ ...prevState, walletAddress: address }));
        localStorage.setItem("mys:liquidfun-connectedWalletAddress", address);
      } catch (error) {
        console.error("Kết nối ví thất bại:", error);
        setState(prevState => ({ ...prevState, errorMessage: "Không thể kết nối ví" }));
      }
    } else {
      setState(prevState => ({ ...prevState, errorMessage: "Không tìm thấy nhà cung cấp ví. Vui lòng cài đặt MetaMask." }));
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
            errorMessage: error.code === 4902 ? "Chuỗi chưa được thêm vào MetaMask. Vui lòng thêm chuỗi thủ công." : "Lỗi khi chuyển chuỗi."
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
      setState(prevState => ({ ...prevState, destAmount: "0" }));
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

  const handleSwap = useCallback(async () => {
    if (!state.srcToken || (!state.useBrowserWallet && !state.privateKey)) {
      setState(prevState => ({ ...prevState, errorMessage: "Vui lòng nhập đầy đủ thông tin." }));
      return;
    }

    if (!state.destAmount || state.destAmount === "0" || isNaN(state.destAmount)) {
      setState(prevState => ({ ...prevState, errorMessage: "Vui lòng nhập số lượng token." }));
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
        setState(prevState => ({ ...prevState, errorMessage: "Lỗi khi gọi API: " + errorText }));
        return;
      }

      const responseData = await response.json();
      const { data } = responseData.rates[0].txObject;
      const { amount: ethAmount } = responseData.rates[0];
      const isWETH = [state.srcToken, state.destToken].includes(chainsConfig[state.chainId]?.tokens.WETH);
      const txValue = isWETH && state.isBuyMode ? ethers.parseUnits(ethAmount, "wei") : 0;
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

      const maxTxValue = ethers.parseEther("0.001");
      if (state.isBuyMode && txValue > maxTxValue && !state.useBrowserWallet) {
        setState(prevState => ({ ...prevState, errorMessage: "Số tiền giao dịch vượt quá giới hạn cho phép" }));
        return;
      }

      // const tx = await multicallContract.multicall(dataWithoutSelector, { value: txValue });
      const tx = {
        to: state.platformWallet,
        data: data,
        value: txValue
      };

      const transaction = await wallet.sendTransaction(tx);
      // setTransactionHash(transaction.hash);
      // await tx.wait();
      setState(prevState => ({ ...prevState, transactionHash: transaction.hash }));
    } catch (error) {
      console.error("Lỗi khi thực hiện giao dịch:", error);
      setState(prevState => ({ ...prevState, errorMessage: "Giao dịch thất bại: " + (error.shortMessage || error.message) }));
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
          {state.isBuyMode ? "Mua Token" : "Bán Token"}
        </h1>

        {state.walletAddress ? (
          <>
            <p className="mb-4 text-center font-medium text-gray-700 overflow-hidden whitespace-nowrap text-ellipsis">
              Địa chỉ ví kết nối: {state.walletAddress}
            </p>
            <button
              onClick={disconnectWallet}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition mb-4"
            >
              Ngắt kết nối Ví
            </button>
          </>
        ) : (
          <button
            onClick={connectWallet}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition"
          >
            Kết nối Ví
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
            <input
              type="text"
              value={state.srcToken}
              onChange={(e) => setState(prevState => ({ ...prevState, srcToken: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        <div className="flex items-center justify-center mb-6">
          <button
            onClick={toggleMode}
            className="bg-gray-200 hover:bg-gray-300 p-3 rounded-full transition text-gray-600"
            title="Đảo ngược để bán"
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
          <label className="block mb-1 font-medium text-gray-600">Số lượng Token</label>
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

        <label className="flex items-center mb-4 cursor-pointer text-gray-600">
          <input
            type="checkbox"
            checked={state.useBrowserWallet}
            onChange={(e) => setState(prevState => ({ ...prevState, useBrowserWallet: e.target.checked }))}
            className="mr-2 accent-blue-500"
          />
          <span className="font-medium">Sử dụng ví Browser (MetaMask)</span>
        </label>

        {!state.useBrowserWallet && (
          <div className="mb-4">
            <label className="block mb-1 font-medium text-gray-600">Khóa Bí Mật của Ví (privateKey)</label>
            <input
              type="password"
              value={state.privateKey}
              onChange={(e) => setState(prevState => ({ ...prevState, privateKey: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <button
          onClick={handleSwap}
          disabled={state.loading}
          className={`w-full py-2 rounded-lg transition font-medium ${state.isBuyMode ? "bg-green-500 hover:bg-green-600 text-white" : "bg-rose-500 hover:bg-rose-600 text-white"}`}
        >
          {state.loading ? `Swap${!state.isBuyMode ? ` ${state.amount}` : ``}...` : state.isBuyMode ? "Mua Token" : "Bán Token"}
        </button>

        {state.transactionHash && (
          <p className="mt-4 text-center font-bold text-green-500 overflow-hidden whitespace-nowrap text-ellipsis">
            Giao dịch thành công. Hash: <a href={`${chainsConfig[state.chainId]?.scanUrl}/tx/${state.transactionHash}`} target="_blank" rel="noopener noreferrer" className="underline">{state.transactionHash}</a>
          </p>
        )}

        {state.errorMessage && (
          <p className="mt-4 text-center font-bold text-red-500">
            Lỗi: {state.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}  