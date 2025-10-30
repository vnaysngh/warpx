const toLower = (value: unknown) =>
  typeof value === "string" ? value.toLowerCase() : "";

export const parseErrorMessage = (error: any): string => {
  const message = toLower(error?.message);
  const shortMessage = toLower(error?.shortMessage);
  const reason = toLower(error?.reason);

  // User rejected transaction
  if (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    shortMessage.includes("user rejected") ||
    shortMessage.includes("user denied") ||
    error?.code === 4001 ||
    error?.code === "ACTION_REJECTED"
  ) {
    return "Transaction rejected by user.";
  }

  // Insufficient funds
  if (
    message.includes("insufficient funds") ||
    shortMessage.includes("insufficient funds")
  ) {
    return "Insufficient funds to complete transaction.";
  }

  if (
    message.includes("insufficient output amount") ||
    shortMessage.includes("insufficient output amount") ||
    reason.includes("insufficient_output_amount")
  ) {
    return "Swap failed: received less than the minimum amount. Increase slippage or reduce the trade size.";
  }

  // Network issues
  if (message.includes("network") || message.includes("timeout")) {
    return "Network error. Please check your connection and try again.";
  }

  // Contract revert with reason
  if (typeof error?.reason === "string") {
    return `Transaction failed: ${error.reason}`;
  }

  // Use shortMessage if available (wagmi/viem provides these)
  if (typeof error?.shortMessage === "string") {
    // Clean up the short message
    const msg = error.shortMessage.replace(/\n.*$/, ""); // Remove everything after first newline
    if (msg.length < 100) {
      return msg;
    }
  }

  // Generic message for unknown errors
  return "Transaction failed. Please try again.";
};
