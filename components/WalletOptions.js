import React from "react";

const WalletOptions = ({ state, setState }) => {
  return (
    <>
      {/* Browser Wallet Checkbox */}
      <label className="flex items-center mb-4 cursor-pointer text-gray-600">
        <input
          type="checkbox"
          checked={state.useBrowserWallet}
          onChange={(e) => setState((prevState) => ({ ...prevState, useBrowserWallet: e.target.checked }))}
          className="mr-2 accent-blue-500"
        />
        <span className="font-medium">Use Browser Wallet (MetaMask)</span>
      </label>

      {/* Private Key Input */}
      {!state.useBrowserWallet && (
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-600">Private key</label>
          <input
            type="password"
            value={state.privateKey}
            onChange={(e) => setState((prevState) => ({ ...prevState, privateKey: e.target.value }))}
            className="w-full p-3 bg-gray-50 rounded-lg text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Extra Gas Fee for Miner Checkbox and Input */}
      {!state.useBrowserWallet && (
        <>
          <label className="flex items-center mb-4 cursor-pointer text-gray-600">
            <input
              type="checkbox"
              checked={state.extraGasForMiner}
              onChange={(e) => setState((prevState) => ({ ...prevState, extraGasForMiner: e.target.checked }))}
              className="mr-2 accent-blue-500"
            />
            <span className="font-medium">Pay additional gas fee for Miner</span>
          </label>
          {state.extraGasForMiner && (
            <label className="flex items-center mb-4 cursor-pointer text-gray-600">
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={state.additionalGas}
                onChange={(e) => setState((prevState) => ({ ...prevState, additionalGas: e.target.value }))}
                className="mr-2 text-black border max-w-24 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 p-2 rounded-lg"
              />
              <span className="font-medium">Gwei</span>
            </label>
          )}
        </>
      )}
    </>
  );
};

export default WalletOptions;
