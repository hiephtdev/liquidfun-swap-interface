import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/router";
import Head from "next/head";
import { chainsConfig } from "@/constants/common";
import HeaderSection from "@/components/HeaderSection";
import PlatformSelection from "@/components/PlatformSelection";
import TokenSelector from "@/components/TokenSelector";
import SlippageSection from "@/components/SlippageSection";
import PlatformComponent from "@/components/PlatformComponent";
import TransactionStatus from "@/components/TransactionStatus";
import WalletOptions from "@/components/WalletOptions";
import ReferralLink from "@/components/ReferralLink";
import { getProvider, fetchAPI, initialState, isValidPrivateKey } from "@/utils/helpers";

export async function getServerSideProps(context) {
  const refAddress = context.query.ref || ethers.ZeroAddress;
  const qreferralLink = `https://fun.moonx.farm/?ref=${refAddress}`;
  return { props: { qreferralLink } };
}

export default function Home({ qreferralLink }) {
  const router = useRouter();
  const { connectWallet: connectPrivyWallet } = usePrivy();
  const { wallets } = useWallets();
  const [state, setState] = useState(initialState);
  const [wallet, setWallet] = useState(null);
  const referralLink = `https://fun.moonx.farm/?ref=${state.walletAddress}`;

  const fetchRefParam = async () => {
    if (state.walletAddress) {
      const { refParam } = await fetchAPI(`/api/get-ref?walletAddress=${state.walletAddress}`);
      setState((prev) => ({ ...prev, ref: refParam || ethers.ZeroAddress }));
    } else if (router.query.ref) {
      setState((prev) => ({ ...prev, ref: ethers.getAddress(router.query.ref) }));
    }
  };

  const loadPurchasedTokens = () => {
    if (typeof window !== "undefined") {
      const tokens = JSON.parse(localStorage.getItem(`mys:${state.platform}-2-purchasedTokens`)) || [];
      setState((prev) => ({ ...prev, purchasedTokens: tokens }));
    }
  };

  const connectWallet = useCallback(async () => {
    if (window.ethereum) {
      try {
        connectPrivyWallet();
      } catch {
        setState((prev) => ({ ...prev, errorMessage: "Failed to connect wallet" }));
      }
    } else {
      setState((prev) => ({ ...prev, errorMessage: "Wallet not found. Install MetaMask." }));
    }
  }, [connectPrivyWallet]);

  // Ngắt kết nối ví
  const disconnectWallet = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      walletAddress: "",
      balance: "0",
      amount: "0"
    }));
    if (wallets && wallets.length > 0) {
      for (let connectWallet of wallets) {
        connectWallet.disconnect();
      }
    }
  }, []);

  useEffect(() => {
    const callbackWhenConnected = async () => {
      try {
        if (wallets && wallets.length > 0) {
          setState(prevState => ({ ...prevState, errorMessage: "" }));
          const address = wallets[0].address;

          // Lưu `refParam` vào db khi có refParam
          if (state.ref !== ethers.ZeroAddress && ethers.isAddress(state.ref)) {
            await fetch("/api/save-ref", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ walletAddress: address, refParam: state.ref }),
            });
          }

          setState((prevState) => ({ ...prevState, walletAddress: address }));
          await fetchTokenBalance(address);
          await fetchWETHBalance(address);
          setWallet(wallets[0]);
        }
      } catch (error) {
        console.error("Lỗi khi kết nối ví:", error);
        setState(prevState => ({ ...prevState, errorMessage: "Error connecting wallet" }));
      }
    };
    callbackWhenConnected();
  }, [wallets, state.ref, state.chainId, state.platform]);

  const initializeWallet = useCallback(async () => {
    if (!state.chainId) return;
    const provider = getProvider(state.chainId);
    if (state.useBrowserWallet && wallets.length) setWallet(wallets[0]);
    else if (state.privateKey && isValidPrivateKey(state.privateKey)) {
      const selectedWallet = new ethers.Wallet(state.privateKey, provider);
      setState((prev) => ({ ...prev, walletAddress: selectedWallet.address }));
      setWallet(selectedWallet);
    } else {
      if (wallets.length) setWallet(wallets[0]);
      else
        setState((prev) => ({ ...prev, errorMessage: "No valid wallet method found." }));
    }
  }, [state.useBrowserWallet, state.privateKey, state.chainId, wallets]);

  const fetchWETHBalance = async (address) => {
    if (address && state.chainId && chainsConfig[state.chainId]?.tokens.WETH) {
      const provider = getProvider(state.chainId);
      const wethContract = new ethers.Contract(
        chainsConfig[state.chainId].tokens.WETH,
        ["function balanceOf(address) view returns (uint256)"],
        provider
      );
      const balance = await wethContract.balanceOf(address);
      const ethBalance = await provider.getBalance(address);
      setState((prev) => ({
        ...prev,
        wethBalance: ethers.formatEther(balance),
        ethBalance: ethers.formatEther(ethBalance),
      }));
    }
  };

  const fetchTokenBalance = async (address) => {
    if (address && state.srcToken && state.chainId) {
      const provider = getProvider(state.chainId);
      const contract = new ethers.Contract(
        ethers.getAddress(state.srcToken),
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        provider
      );

      const [balance, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);
      const balanceOf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(ethers.formatUnits(balance, decimals))
      setState((prev) => ({ ...prev, balance: `${balance}`, fomartAmount: balanceOf, amount: `${balance}` }));
    }
  };

  const handlePlatformChange = (platform) => setState((prev) => ({ ...prev, platform }));

  const handleStateChange = (field, value) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleMode = () => {
    setState((prev) => ({
      ...prev,
      isBuyMode: !prev.isBuyMode,
      srcToken: prev.destToken,
      destToken: prev.srcToken,
      amount: prev.isBuyMode ? "0" : prev.balance,
    }));
  };

  useEffect(() => { fetchRefParam(); }, [router.query, state.walletAddress]);
  useEffect(() => { loadPurchasedTokens(); }, [state.platform]);
  useEffect(() => { initializeWallet(); }, [initializeWallet]);
  useEffect(() => { if (state.walletAddress && !state.isBuyMode) fetchTokenBalance(state.walletAddress); else setState((prev) => ({ ...prev, balance: "0", amount: "0" })); }, [state.walletAddress, state.isBuyMode, state.srcToken, state.platform, state.chainId]);
  useEffect(() => { if (state.walletAddress) fetchWETHBalance(state.walletAddress); }, [state.walletAddress, state.chainId, state.srcToken, state.destToken, state.platform]);

  return (
    <>
      <Head>
        <title>MoonX Farm - Fast and Secure Token Trading</title>
        <meta property="og:url" content={qreferralLink ?? "https://fun.moonx.farm"} />
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://fun.moonx.farm/card.jpg" />
        <meta property="fc:frame:button:1" content="Trade Now" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={qreferralLink ?? "https://fun.moonx.farm"} />
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 p-10 flex justify-center items-center">
        <div className="w-full max-w-xl bg-white p-6 rounded-xl shadow-lg shadow-gray-400/30 relative">
          <HeaderSection state={state} connectWallet={connectWallet} disconnectWallet={disconnectWallet} />
          <PlatformSelection platform={state.platform} handlePlatformChange={handlePlatformChange} />
          <TokenSelector
            state={state}
            handleStateChange={handleStateChange}
            handleToggleMode={handleToggleMode}
            fetchTokenBalance={fetchTokenBalance}
            getProvider={() => getProvider(state.chainId)}
          />
          <WalletOptions state={state} setState={setState} />
          <SlippageSection state={state} setState={setState} />
          <PlatformComponent
            platform={state.platform}
            state={state}
            wallet={wallet}
            handleStateChange={handleStateChange}
            fetchTokenBalance={fetchTokenBalance}
            fetchWETHBalance={fetchWETHBalance}
          />
          <TransactionStatus state={state} />
          <ReferralLink state={state} referralLink={referralLink} />
        </div>
      </div>
    </>
  );
}
