import "@/styles/globals.css";
import { PrivyProvider } from '@privy-io/react-auth';

export default function App({ Component, pageProps }) {
  return (
    <PrivyProvider
      appId="cm3cecqfg0bdwq8874f9ayinp">
      <Component {...pageProps} />
    </PrivyProvider>
  )
}
