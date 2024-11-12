import React from "react";

const SlippageSection = ({ state, setState }) => {
  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium text-gray-600">Slippage</label>
      <input
        type="range"
        min="0"
        max="100"
        value={state.slippage}
        onChange={(e) => setState((prev) => ({ ...prev, slippage: parseInt(e.target.value) }))}
        className="w-full"
      />
      <div className="text-center text-gray-700">{state.slippage}%</div>
    </div>
  );
};

export default SlippageSection;
