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
      "0x077cc1993e80f31770562a4e2ba73b18eae5696a3aa029cba0daea192149f9c0",
    registryAddress:
      "0x04d99aab35ddd17c1a6dca70f1de249c9120af32c2f92cb735dfcbdaec76cc1b",
    viewerAddress:
      "0x07412f3b2098e8b2b50df3859466784ecb0ea4d5b5a200347605568188bf5541",
  },
  sepolia: {
    chainId: "SN_SEPOLIA",
    rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    apiUrl: "https://denshokan-api-sepolia.up.railway.app",
    wsUrl: "wss://denshokan-api-sepolia.up.railway.app/ws",
    denshokanAddress:
      "0x017eae504f5716423d423c3fe5640b4dcf830a9634c243d86f6fe0cc01b688c3",
    registryAddress:
      "0x04e2b728f2b0209ede6f3fd01ec190c33d1d73aa628ad5e9f80549ba62d0e331",
    viewerAddress:
      "0x036d3cab94a44a63ecd063d1c26e1f37915c75a2e0ae419e2f8f56421c2278b6",
  },
};

export function getChainConfig(chain: string): ChainConfig {
  const config = CHAIN_CONFIGS[chain];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return config;
}
