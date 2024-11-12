import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { chainsConfig } from "@/constants/common";

export default function MoonXPlatform({
  chainId,
  rpcUrl,
  isBuyMode,
  wallet,
  tokenAdress,
  slippage,
  amount,
  useBrowserWallet,
  handleTransactionComplete,
  loadBalance,
  addTokenToStorage,
  extraGasForMiner,
  referral,
  additionalGas,
  removeTokenFromStorage,
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAmountOut, setLoadingAmountOut] = useState(false);
  const [displayAmount, setDisplayAmount] = useState("0");

  // Creates an instance of the MoonX contract
  const getContractInstance = async () => {
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
      process.env.NEXT_PUBLIC_MOONX_ADDRESS,
      [
        "function moonXBuy(address tokenOut, uint8 slippagePercentage, address referrer) external payable",
        "function moonXSell(address tokenIn, uint256[2] amountIns, uint8 slippagePercentage, address referrer) external",
      ],
      currentWallet
    );
  };

  // Creates an instance of the token contract to perform `approve`
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
      tokenAdress,
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

  // Executes a buy or sell transaction based on mode
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
      const contract = await getContractInstance();
      let transaction;

      if (isBuyMode) {
        addTokenToStorage(tokenAdress);
      }

      if (useBrowserWallet) {
        // Executes transaction with browser wallet
        transaction = isBuyMode
          ? await contract.moonXBuy(tokenAdress, slippage, referral, { value: ethers.parseEther(amount) })
          : await handleSellWithApprove();
      } else {
        // Executes transaction using RPC, calculating gas limit
        transaction = await executeTransaction(isBuyMode);
      }

      await transaction.wait();
      handleTransactionComplete(transaction.hash);
      loadBalance(wallet.address);
    } catch (error) {
      console.error("Error executing transaction on MoonX:", error);
      setErrorMessage(`Error executing transaction: ${error.reason ?? error.shortMessage ?? error.message ?? error}`);
    } finally {
      setLoading(false);
    }
  };

  // Approves token and executes a sell transaction
  const handleSellWithApprove = async () => {
    const tokenContract = await getTokenContractInstance();
    const contract = await getContractInstance();
    const spenderAddress = process.env.NEXT_PUBLIC_MOONX_CONTRACT_ADDRESS;

    // Checks allowance
    const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
    if (allowance < amount) {
      const approveTx = await tokenContract.approve(spenderAddress, amount);
      await approveTx.wait();
    }

    // Executes sell transaction
    return await contract.moonXSell(tokenAdress, [0n, amount], slippage, referral);
  };

  // Executes transaction with gas estimation, used if `useBrowserWallet` is false
  const executeTransaction = async (isBuyMode) => {
    const contract = await getContractInstance();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    if (isBuyMode) {
      const estimatedGas = await contract.moonXBuy.estimateGas(tokenAdress, slippage, referral, { value: ethers.parseEther(amount) });
      const gasLimit = estimatedGas * BigInt(300) / BigInt(100);
      const gasData = await provider.getFeeData();
      const gasOptions = extraGasForMiner
        ? {
          maxPriorityFeePerGas: gasData.maxPriorityFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"),
          maxFeePerGas: gasData.maxFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"),
        }
        : { gasPrice: gasData.gasPrice * 2n };

      return await contract.moonXBuy(tokenAdress, slippage, referral, { value: ethers.parseEther(amount), gasLimit, ...gasOptions });
    } else {
      const tokenContract = await getTokenContractInstance();
      const spenderAddress = process.env.NEXT_PUBLIC_MOONX_CONTRACT_ADDRESS;

      // Checks allowance and approves if necessary
      const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
      if (allowance < amount) {
        const approveTx = await tokenContract.approve(spenderAddress, amount);
        await approveTx.wait();
      }

      const estimatedGas = await contract.moonXSell.estimateGas(tokenAdress, [0n, amount], slippage, referral);
      const gasLimit = estimatedGas * BigInt(300) / BigInt(100);
      const gasData = await provider.getFeeData();
      const gasOptions = extraGasForMiner
        ? {
          maxPriorityFeePerGas: gasData.maxPriorityFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"),
          maxFeePerGas: gasData.maxFeePerGas + ethers.parseUnits(`${additionalGas}`, "gwei"),
        }
        : { gasPrice: gasData.gasPrice * 2n };

      return await contract.moonXSell(tokenAdress, [0n, amount], slippage, referral, { gasLimit, ...gasOptions });
    }
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
        if (!tokenAdress || !ethers.isAddress(tokenAdress)) {
          setDisplayAmount("0");
          return;
        }
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const tokenContract = new ethers.Contract(tokenAdress, ["function decimals() view returns (uint8)", "function symbol() view returns (string)"], provider);

        const getDecimals = async () => (isBuyMode ? await tokenContract.decimals() : 18);
        const getSymbol = async () => (isBuyMode ? await tokenContract.symbol() : "ETH");

        const [amountOut, decimals, symbol] = await Promise.all([
          calculateAmountsOutMin({
            tokenIn: isBuyMode ? chainsConfig[chainId].tokens.WETH : tokenAdress,
            tokenOut: isBuyMode ? tokenAdress : chainsConfig[chainId].tokens.WETH,
            amountIn: isBuyMode ? ethers.parseEther(amount) : amount
          }),
          getDecimals(),
          getSymbol(),
        ]);

        setDisplayAmount(new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(ethers.formatUnits(amountOut.amountOutMin, decimals)) + ` ${symbol}`);
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
  }, [isBuyMode, amount, tokenAdress, slippage, chainId]);

  // Calculates minimum output amount with slippage adjustments
  const calculateAmountsOutMin = async ({ tokenIn, tokenOut, amountIn, feeTiers = [500, 3000, 10000] }) => {
    if (!tokenIn || !tokenOut || !amountIn) return { amountOutMin: 0n, poolAddress: ethers.ZeroAddress };
    const factoryAbi = ["function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)"];
    const quoterAbi = [
      {
        "inputs": [{ "components": [{ "name": "tokenIn", "type": "address" }, { "name": "tokenOut", "type": "address" }, { "name": "amountIn", "type": "uint256" }, { "name": "fee", "type": "uint24" }, { "name": "sqrtPriceLimitX96", "type": "uint160" }], "name": "params", "type": "tuple" }],
        "name": "quoteExactInputSingle",
        "outputs": [{ "name": "amountOut", "type": "uint256" }],
        "type": "function",
      },
    ];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const factory = new ethers.Contract(chainsConfig[chainId].factory, factoryAbi, provider);
    const quoter = new ethers.Contract(chainsConfig[chainId].quote, quoterAbi, provider);

    let bestQuote = 0n;
    let poolAddress = ethers.ZeroAddress;

    for (const fee of feeTiers) {
      try {
        poolAddress = await factory.getPool(tokenIn, tokenOut, fee);
        if (poolAddress === ethers.ZeroAddress) continue;

        const params = { tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0 };
        const [amountOut] = await quoter.quoteExactInputSingle.staticCallResult(params);
        if (amountOut > bestQuote) bestQuote = amountOut;
      } catch {
        continue;
      }
    }

    const amountOutMin = bestQuote;
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
        {loading ? (isBuyMode ? "Buying..." : "Selling...") : isBuyMode ? "Buy Token on MoonX" : "Sell Token on MoonX"}
      </button>
      {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
    </div>
  );
}
