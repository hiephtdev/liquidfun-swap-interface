import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <title>MoonX Farm - Fast and Secure Token Trading on LiquidFun & Wow.XYZ</title>

      <meta property="og:title" content="MoonX Farm - Fast and Secure Token Trading on LiquidFun & Wow.XYZ" />
      <meta property="og:description" content="Trade tokens quickly and securely on MoonX Farm. Connect your wallet to trade on LiquidFun and Wow.XYZ or add liquidity on DEX platforms similar to Uniswap. Supports MetaMask and popular tokens like WETH, USDC, and USDT." />
      <meta property="og:image" content="https://fun.moonx.farm/card.jpg" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="MoonX Farm - Fast and Secure Token Trading on LiquidFun & Wow.XYZ" />
      <meta name="twitter:description" content="Connect your MetaMask wallet and trade tokens like WETH, USDC, USDT on LiquidFun and Wow.XYZ or add liquidity on DEX platforms similar to Uniswap." />
      <meta name="twitter:image" content="https://fun.moonx.farm/card.jpg" />

      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/js/all.min.js" crossorigin="anonymous"></script>
      <Head />
      <body className="antialiased font-sans">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
