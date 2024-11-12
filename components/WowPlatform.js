import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { chainsConfig } from "@/constants/common";

export default function WowPlatform({
  chainId,
  rpcUrl,
  isBuyMode,
  wallet,
  contractAddress,
  amount,
  useBrowserWallet,
  handleTransactionComplete,
  loadBalance,
  addTokenToStorage,
  extraGasForMiner,
  additionalGas,
  removeTokenFromStorage,
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayAmount, setDisplayAmount] = useState("0");
  const [loadingAmountOut, setLoadingAmountOut] = useState(false);

  // Function to create an instance of the contract using the configured `wallet`
  const getContractInstance = async () => {
    let currentWallet = wallet;
    if (useBrowserWallet) {
      // Check chain ID
      if (wallet.chainId !== `eip155:${chainId}`) {
        await wallet.switchChain(parseInt(chainId));
      }
      const ethereumProvider = await wallet.getEthereumProvider();
      const provider = new ethers.BrowserProvider(ethereumProvider);
      currentWallet = await provider.getSigner();
    }
    return new ethers.Contract(
      process.env.NEXT_PUBLIC_MOONX_WOW_CONTRACT_ADDRESS,
      [
        "function placeOrder(address token, uint256 amount, bool isBuy)"
      ],
      currentWallet
    );
  };

  // Function to create an instance of the token contract for `approve` functionality
  const getTokenContractInstance = async () => {
    let currentWallet = wallet;
    if (useBrowserWallet) {
      if (wallet.chainId !== `eip155:${chainId}`) {
        await wallet.switchChain(parseInt(chainId));
      }
      const ethereumProvider = await wallet.getEthereumProvider();
      const provider = new ethers.BrowserProvider(ethereumProvider);
      currentWallet = await provider.getSigner();
    }
    return new ethers.Contract(
      contractAddress,
      [
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
      ],
      currentWallet
    );
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
      if (isBuyMode) {
        addTokenToStorage(contractAddress);
      }

      // Approve the token if it’s a sell transaction
      if (!isBuyMode) await approve();

      const transactionOptions = isBuyMode ? { value: ethers.parseEther(amount) } : {};
      const transaction = useBrowserWallet
        ? await contract.placeOrder(contractAddress, isBuyMode ? ethers.parseEther(amount) : amount, isBuyMode, transactionOptions)
        : await executeTransaction(isBuyMode);

      const receipt = await transaction.wait();
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

  // Handles approval for the token if allowance is insufficient
  const approve = async () => {
    const tokenContract = await getTokenContractInstance();
    const spenderAddress = process.env.NEXT_PUBLIC_MOONX_WOW_CONTRACT_ADDRESS;

    const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
    if (allowance < amount) {
      const approveTx = await tokenContract.approve(spenderAddress, amount);
      const receipt = await approveTx.wait();
    }
  };

  // Executes the transaction with gas estimation, only when `useBrowserWallet` is false
  const executeTransaction = async (isBuyMode) => {
    const contract = await getContractInstance();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const transactionOptions = isBuyMode ? { value: ethers.parseEther(amount) } : {};

    const estimatedGas = await contract.placeOrder.estimateGas(
      contractAddress,
      isBuyMode ? ethers.parseEther(amount) : amount,
      isBuyMode,
      transactionOptions
    );

    const gasLimit = estimatedGas * BigInt(300) / BigInt(100);
    const gasData = await provider.getFeeData();
    const gasOptions = extraGasForMiner
      ? {
        maxPriorityFeePerGas: gasData.maxPriorityFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"),
        maxFeePerGas: gasData.maxFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"),
      }
      : { gasPrice: gasData.gasPrice * 2n };

    return await contract.placeOrder(
      contractAddress,
      isBuyMode ? ethers.parseEther(amount) : amount,
      isBuyMode,
      { gasLimit, ...gasOptions, ...transactionOptions }
    );
  };

  // Fetches the minimum output amount based on slippage and updates the displayed amount
  useEffect(() => {
    const fetchAmountOutMin = async () => {
      try {
        if (!amount || amount === "0" || Number.parseFloat(amount) <= 0) {
          setDisplayAmount("0");
          return;
        }
        setLoadingAmountOut(true);
        if (!contractAddress || !ethers.isAddress(contractAddress)) {
          setDisplayAmount("0");
          return;
        }
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const tokenContract = new ethers.Contract(contractAddress, [
          "function getEthBuyQuote(uint256 ethOrderSize) view returns (uint256)",
          "function getTokenBuyQuote(uint256 tokenOrderSize) view returns (uint256)",
          "function marketType() view returns (uint8)",
          "function marketType() view returns (uint8)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"], provider);

        const getDecimals = async () => (isBuyMode ? await tokenContract.decimals() : 18);
        const getSymbol = async () => (isBuyMode ? await tokenContract.symbol() : "ETH");
        let amountOut; let decimals; let symbol; let amountOuts;
        const marketType = await tokenContract.marketType();
        if (marketType === 1n) {
          [amountOuts, decimals, symbol] = await Promise.all([
            calculateUniswapAmountsOutMin({
              tokenIn: isBuyMode ? chainsConfig[chainId].tokens.WETH : contractAddress,
              tokenOut: isBuyMode ? contractAddress : chainsConfig[chainId].tokens.WETH,
              amountIn: isBuyMode ? ethers.parseEther(amount) : amount
            }),
            getDecimals(),
            getSymbol(),
          ]);
          amountOut = amountOuts.amountOutMin;
        } else {
          [amountOut, decimals, symbol] = await Promise.all([
            isBuyMode ? tokenContract.getEthBuyQuote(ethers.parseEther(amount)) : tokenContract.getTokenBuyQuote(amount),
            getDecimals(),
            getSymbol(),
          ]);
        }
        setDisplayAmount(new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(ethers.formatUnits(amountOut, decimals)) + ` ${symbol}`);
      } catch (error) {
        console.error("Error fetching minimum amount:", error);
        setDisplayAmount("0");
      } finally {
        setLoadingAmountOut(false);
      }
    };

    const intervalId = setInterval(fetchAmountOutMin, 10000);
    fetchAmountOutMin();

    return () => clearInterval(intervalId);
  }, [isBuyMode, amount, contractAddress, chainId]);

  // Calculates minimum output amount with slippage adjustments
  const calculateUniswapAmountsOutMin = async ({ tokenIn, tokenOut, amountIn }) => {
    if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut) || !amountIn) {
      return { amountOutMin: 0n, poolAddress: ethers.ZeroAddress };
    }
    const quoterAbi = [
      {
        "inputs": [{ "components": [{ "name": "tokenIn", "type": "address" }, { "name": "tokenOut", "type": "address" }, { "name": "amountIn", "type": "uint256" }, { "name": "fee", "type": "uint24" }, { "name": "sqrtPriceLimitX96", "type": "uint160" }], "name": "params", "type": "tuple" }],
        "name": "quoteExactInputSingle",
        "outputs": [{ "name": "amountOut", "type": "uint256" }],
        "type": "function",
      },
    ];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const quoter = new ethers.Contract(chainsConfig[chainId].quote, quoterAbi, provider);
    let poolAddress = ethers.ZeroAddress;
    const params = { tokenIn, tokenOut, amountIn, fee: 500, sqrtPriceLimitX96: 0 };
    debugger
    const [amountOut] = await quoter.quoteExactInputSingle.staticCallResult(params);

    const amountOutMin = amountOut;
    return { amountOutMin, poolAddress };
  };

  return (
    <div>
      <div className="mb-4 text-center italic font-semibold">
        {`Amount to receive (not with slippage): ${!loadingAmountOut ? displayAmount : "..."}`}
      </div>
      <button
        onClick={handleTransaction}
        disabled={loading}
        className={`w-full p-2 rounded ${isBuyMode ? "bg-green-600 hover:bg-green-800" : "bg-red-600 hover:bg-red-800"} text-white font-medium`}
      >
        {loading ? (isBuyMode ? "Buying..." : "Selling...") : isBuyMode ? "Buy Token on Wow" : "Sell Token on Wow"}
      </button>
      {errorMessage && (
        <p className="text-red-500 mt-4">{errorMessage}</p>
      )}
    </div>
  );
}
