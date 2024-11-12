import React from "react";

const PlatformSelection = ({ platform, handlePlatformChange }) => {
  return (
    <div className="flex justify-center mb-6">
      {["liquidfun", "wow", "moonx"].map((plat) => (
        <label key={plat} className="mr-4 cursor-pointer">
          <input
            type="radio"
            name="platform"
            value={plat}
            checked={platform === plat}
            onChange={() => handlePlatformChange(plat)}
            className="mr-2"
          />
          {plat.charAt(0).toUpperCase() + plat.slice(1)} {/* Capitalizes the first letter */}
        </label>
      ))}
    </div>
  );
};

export default PlatformSelection;
