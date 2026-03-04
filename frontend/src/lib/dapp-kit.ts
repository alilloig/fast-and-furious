import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI_NETWORK } from "./constants";

function makeDAppKit() {
  return createDAppKit({
    networks: ["testnet", "mainnet"],
    defaultNetwork: SUI_NETWORK,
    createClient(network) {
      return new SuiGrpcClient({
        network,
        baseUrl:
          network === "mainnet"
            ? "https://sui-mainnet.mystenlabs.com"
            : "https://sui-testnet.mystenlabs.com",
      });
    },
  });
}

type AppDAppKit = ReturnType<typeof makeDAppKit>;

let _instance: AppDAppKit | null = null;

export function getDAppKit(): AppDAppKit {
  if (!_instance) {
    _instance = makeDAppKit();
  }
  return _instance;
}
