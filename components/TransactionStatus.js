import { chainsConfig } from "@/constants/common";
import React from "react";

const TransactionStatus = ({ state }) => {
  return (
    <>
      {state.transactionHash && (
        <p className="mt-4 text-center font-bold text-green-500 overflow-hidden whitespace-nowrap text-ellipsis">
          Transaction successful. Tx:{" "}
          <a
            href={`${chainsConfig[state.chainId]?.scanUrl}/tx/${state.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {state.transactionHash}
          </a>
        </p>
      )}

      {state.errorMessage && (
        <p className="mt-4 text-center font-bold text-red-500">
          Error: {state.errorMessage}
        </p>
      )}
    </>
  );
};

export default TransactionStatus;
