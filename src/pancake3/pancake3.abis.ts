export const DEFAULT_FEE_TIER = 3000;

export const factoryAbi = [
  "function getPool(address token0, address token1, uint24 fee) external view returns (address)",
];

export const poolAbi = [
  "function slot0() external view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function ticks(int24) external view returns (uint128 liquidityGross,int128 liquidityNet,uint256 feeGrowthOutside0X128,uint256 feeGrowthOutside1X128,int56 tickCumulativeOutside,int160 secondsPerLiquidityOutsideX128,uint32 secondsOutside,bool initialized)",
];

export const routerAbi = [
  `function exactInputSingle(
      (address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)
    ) external payable returns (uint256 amountOut)`,
];

export const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function withdraw(uint256) public",
  "function deposit() public payable",
];
