export interface ChainConfig {
  chainId: string;
  rpcUrl: string;
  apiUrl: string;
  wsUrl: string;
  denshokanAddress: string;
  registryAddress: string;
  viewerAddress: string;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  mainnet: {
    chainId: "SN_MAIN",
    rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet",
    apiUrl: "https://denshokan-api-production.up.railway.app",
    wsUrl: "wss://denshokan-api-production.up.railway.app/ws",
    denshokanAddress:
      "0x0029ffae8b0c4626e06395a947800bc89e76422107f6adff8937a6e9a1e01f28",
    registryAddress:
      "0x05b4a2ed39dfb28a33c2dd73cbedf02091a31dccb9ed4ed19201e3c255865851",
    viewerAddress:
      "0x01825fa210dc2abd02fa03d4eb37dabf1d6b69e9c4cd471ee402fa0fcc78611b",
  },
  sepolia: {
    chainId: "SN_SEPOLIA",
    rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    apiUrl: "https://denshokan-api-sepolia.up.railway.app",
    wsUrl: "wss://denshokan-api-sepolia.up.railway.app/ws",
    denshokanAddress:
      "0x05178014ac8150207c795a9e426cfcbb0546ba1e033e869b04e0b6d8c2791e64",
    registryAddress:
      "0x02d6dfa06df59948cd5b967ef9644d071525ddc5226bf21e0578d7265e22113d",
    viewerAddress:
      "0x0658d5f90ddeaa20ccc22cdb25bda7a42594c3745ba500999fb966bfc40f8a55",
  },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAIN_CONFIGS[chain];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return config;
}
