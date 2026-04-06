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
      "0x00263cc540dac11334470a64759e03952ee2f84a290e99ba8cbc391245cd0bf9",
    registryAddress:
      "0x02cbaec07913d3580822e5811e575ab657ee0362c022b8df56214cb6ca95fe06",
    viewerAddress:
      "0x04b71fe06bc359e5b105857f8d7781b5390066f459c733604abeaa3c6e884875",
  },
  sepolia: {
    chainId: "SN_SEPOLIA",
    rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    apiUrl: "https://denshokan-api-sepolia.up.railway.app",
    wsUrl: "wss://denshokan-api-sepolia.up.railway.app/ws",
    denshokanAddress:
      "0x0004e6e5bbf18424dfb825f1dbb65e10473b4603a1ec7b9ab02c143d877114f9",
    registryAddress:
      "0x06794040fa260cbc80630b90c5e63f9bc6b1b572d9289175b409e70ae2c234b6",
    viewerAddress:
      "0x010527799357ce3c8e71700b9a13485afcd25304cfebb393919b369845c68f6f",
  },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAIN_CONFIGS[chain];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return config;
}
