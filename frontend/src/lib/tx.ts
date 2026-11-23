import { erc20Abi, type Abi, type Address, type ContractFunctionArgs, type ContractFunctionName, type Hash, type TransactionReceipt } from "viem";
import { PACTIQ_ABI } from "./pactiqAbi";
import { CONTRACT_ADDRESS } from "./chain";
import { publicClient } from "./pactiq";
import { tokenAllowance } from "./qie";
import type { WalletState } from "@/hooks/useWallet";

type WriteName = ContractFunctionName<typeof PACTIQ_ABI, "payable" | "nonpayable">;

interface TxOpts {
  value?: bigint;
  onSubmitted?: (hash: Hash) => void;
}

/**
 * Simulate (to surface revert reasons before the wallet pops up), send, and wait for the receipt.
 */
export async function sendTx(
  wallet: WalletState,
  call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] },
  opts: TxOpts = {}
): Promise<TransactionReceipt> {
  const client = await wallet.getWalletClient();
  const account = client.account.address as Address;

  const { request } = await publicClient.simulateContract({ ...call, account, value: opts.value });
  // Pad the gas estimate: tight estimates can run out of gas on pool/token writes (EIP-2200 stipend).
  const estimate = await publicClient.estimateContractGas({ ...call, account, value: opts.value }).catch(() => null);
  const gas = estimate ? (estimate * 125n) / 100n : undefined;
  const hash = await client.writeContract({ ...(request as Parameters<typeof client.writeContract>[0]), gas });
  opts.onSubmitted?.(hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
  wallet.refreshBalance();
  return receipt;
}

export async function sendPactiqTx<N extends WriteName>(
  wallet: WalletState,
  functionName: N,
  args: ContractFunctionArgs<typeof PACTIQ_ABI, "payable" | "nonpayable", N>,
  opts: TxOpts = {}
): Promise<TransactionReceipt> {
  if (!CONTRACT_ADDRESS) throw new Error("Contract address not configured.");
  return sendTx(wallet, { address: CONTRACT_ADDRESS, abi: PACTIQ_ABI as Abi, functionName, args: args as readonly unknown[] }, opts);
}

/**
 * Make sure the vault may pull `amount` of `token`. Approves exactly what this action needs,
 * never an unlimited allowance. No-op when the allowance already covers it.
 */
export async function ensureAllowance(
  wallet: WalletState,
  token: Address,
  amount: bigint,
  onStatus?: (s: string) => void
): Promise<void> {
  if (!CONTRACT_ADDRESS || !wallet.address || amount === 0n) return;
  const current = await tokenAllowance(token, wallet.address, CONTRACT_ADDRESS);
  if (current >= amount) return;
  onStatus?.("Approve QUSDC in your wallet (step 1 of 2)…");
  await sendTx(
    wallet,
    { address: token, abi: erc20Abi as Abi, functionName: "approve", args: [CONTRACT_ADDRESS, amount] },
    { onSubmitted: () => onStatus?.("Approving QUSDC…") }
  );
}
