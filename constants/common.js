export const chainsConfig = {
    "8453": {
        name: "Base",
        rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE,
        tokens: {
            WETH: "0x4200000000000000000000000000000000000006",
            USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"
        },
        scanUrl: "https://basescan.org",
        factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
        quote: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"
    },
    "10": {
        name: "Optimism",
        rpcUrl: process.env.NEXT_PUBLIC_RPC_OPTIMISM,
        tokens: {
            WETH: "0x4200000000000000000000000000000000000006",
            USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"
        },
        scanUrl: "https://optimistic.etherscan.io",
        factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        quote: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"
    },
    "42161": {
        name: "Arbitrum",
        rpcUrl: process.env.NEXT_PUBLIC_RPC_ARBITRUM,
        tokens: {
            WETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
        },
        scanUrl: "https://arbiscan.io",
        factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        quote: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"
    },
    "1": {
        name: "Ethereum",
        rpcUrl: process.env.NEXT_PUBLIC_RPC_ETHEREUM,
        tokens: {
            WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        },
        scanUrl: "https://etherscan.io",
        factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        quote: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"
    }
};
