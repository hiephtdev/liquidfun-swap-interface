import React from "react";
import FarcasterShareIcon from "@/components/icons/FarcasterShareIcon";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faX } from "@fortawesome/free-solid-svg-icons";

const ReferralLink = ({ state, referralLink }) => {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      alert("Referral link copied to clipboard!");
    });
  };

  const handleShareOnX = () => {
    const shareUrl = `https://x.com/intent/post?text=%F0%9F%9A%80+Trade+Fast+%26+Secure+on+MoonXFarm%21+%F0%9F%90%82%F0%9F%92%B0%0A%0AConnect+your+wallet+to+trade+tokens+on+%40liquiddotfun%2C+%40wow+%26+Uniswap.%0A%0AGet+real-time+deals+%26+updates%21%0A%0A%F0%9F%91%89+Sign+up%3A+${encodeURIComponent(
      referralLink
    )}%0A%0A%23Crypto+%23TokenTrading+%23DeFi+%23MoonXFarm`;
    window.open(shareUrl, "_blank");
  };

  const handleShareOnWarpcast = () => {
    const shareUrl = `https://warpcast.com/~/compose?text=%F0%9F%9A%80+Trade+Fast+%26+Secure+on+MoonXFarm%21+%F0%9F%90%82%F0%9F%92%B0%0A%0AConnect+your+wallet+to+trade+tokens+on+%40liquiddotfun%2C+%40wow+%26+Uniswap.%0A%0AGet+real-time+deals+%26+updates%21%0A%0A%F0%9F%91%89+Sign+up%3A+${encodeURIComponent(
      referralLink
    )}%0A%0A%23Crypto+%23TokenTrading+%23DeFi+%23MoonXFarm`;
    window.open(shareUrl, "_blank");
  };

  return (
    <div className="flex justify-between items-center text-gray-800 mt-5">
      <div className="flex items-center space-x-2">
        <button onClick={() => window.open("https://warpcast.com/~/channel/funmoonxfarm", "_blank")}>
          <FarcasterShareIcon className="text-[#8660cd]" />
        </button>
      </div>
      <div className="flex items-center space-x-2">
        <span>Share your referral link</span>
        <button onClick={handleCopyLink}>
          <FontAwesomeIcon icon={faCopy} className="cursor-pointer text-gray-500 hover:text-blue-700" />
        </button>
        <button onClick={handleShareOnX}>
          <FontAwesomeIcon icon={faX} className="text-blue-500" />
        </button>
        <button onClick={handleShareOnWarpcast}>
          <FarcasterShareIcon className="text-[#8660cd]" />
        </button>
      </div>
    </div>
  );
};

export default ReferralLink;
