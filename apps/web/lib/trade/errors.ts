const toLower = (value: unknown) =>
  typeof value === "string" ? value.toLowerCase() : "";

/**
 * Extracts a clean, user-friendly error message from various error types
 * All messages are kept under 50 characters for mobile display
 */
export const parseErrorMessage = (error: any): string => {
  // Handle null/undefined
  if (!error) {
    return "Something went wrong. Try again.";
  }

  const message = toLower(error?.message);
  const shortMessage = toLower(error?.shortMessage);
  const reason = toLower(error?.reason);
  const details = toLower(error?.details);
  const data = toLower(error?.data?.message);

  // === NETWORK & RPC ERRORS ===

  // Rate limiting
  if (
    message.includes("rate limit") ||
    message.includes("ratelimit") ||
    message.includes("too many requests") ||
    message.includes("compute unit limit") ||
    details.includes("rate limit") ||
    details.includes("ratelimit") ||
    error?.status === 429
  ) {
    return "Network busy. Try again.";
  }

  // Network/connection issues
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("connection") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    error?.code === "NETWORK_ERROR" ||
    error?.code === "TIMEOUT"
  ) {
    return "Connection issue. Check network.";
  }

  // RPC errors
  if (
    message.includes("could not detect network") ||
    message.includes("missing provider") ||
    message.includes("provider error")
  ) {
    return "RPC error. Try refreshing.";
  }

  // === USER ACTIONS ===

  // User rejected transaction
  if (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("user cancelled") ||
    shortMessage.includes("user rejected") ||
    shortMessage.includes("user denied") ||
    error?.code === 4001 ||
    error?.code === "ACTION_REJECTED"
  ) {
    return "Transaction cancelled";
  }

  // === TRANSACTION ERRORS ===

  // Insufficient funds
  if (
    message.includes("insufficient funds") ||
    message.includes("insufficient balance") ||
    shortMessage.includes("insufficient funds") ||
    reason.includes("insufficient")
  ) {
    return "Insufficient funds";
  }

  // Slippage errors
  if (
    message.includes("insufficient output amount") ||
    message.includes("insufficient input amount") ||
    shortMessage.includes("insufficient output amount") ||
    shortMessage.includes("insufficient input amount") ||
    reason.includes("insufficient_output_amount") ||
    reason.includes("insufficient_input_amount") ||
    message.includes("slippage")
  ) {
    return "Price changed. Adjust slippage.";
  }

  // Liquidity errors
  if (
    message.includes("insufficient liquidity") ||
    reason.includes("insufficient liquidity") ||
    message.includes("no liquidity")
  ) {
    return "Not enough liquidity";
  }

  // Deadline errors
  if (
    message.includes("expired") ||
    message.includes("deadline") ||
    reason.includes("expired")
  ) {
    return "Transaction expired. Try again.";
  }

  // Gas errors
  if (
    message.includes("out of gas") ||
    message.includes("gas required exceeds") ||
    message.includes("intrinsic gas") ||
    shortMessage.includes("gas") ||
    error?.code === "UNPREDICTABLE_GAS_LIMIT"
  ) {
    return "Gas estimate failed. Check inputs.";
  }

  // Nonce errors
  if (
    message.includes("nonce") ||
    message.includes("replacement transaction")
  ) {
    return "Transaction conflict. Retry.";
  }

  // === CONTRACT SPECIFIC ERRORS ===

  // Transfer errors
  if (
    message.includes("transfer amount exceeds balance") ||
    reason.includes("transfer amount exceeds")
  ) {
    return "Transfer exceeds balance";
  }

  // Approval errors
  if (
    message.includes("approve") ||
    message.includes("allowance")
  ) {
    return "Approval failed. Try again.";
  }

  // Identical addresses
  if (
    message.includes("identical addresses") ||
    reason.includes("identical")
  ) {
    return "Cannot swap identical tokens";
  }

  // Zero amount
  if (
    message.includes("insufficient amount") ||
    message.includes("zero amount") ||
    reason.includes("insufficient amount")
  ) {
    return "Amount too small";
  }

  // === EXTRACT CLEAN ERROR FROM REASON ===

  // Try to extract contract revert reason
  if (typeof error?.reason === "string" && error.reason.length > 0) {
    let cleanReason = error.reason
      .replace(/^execution reverted:?\s*/i, "")
      .replace(/^revert:?\s*/i, "")
      .replace(/^Error:?\s*/i, "")
      .trim();

    // Skip if it's just technical jargon
    if (
      !cleanReason.includes("0x") &&
      !cleanReason.includes("function") &&
      cleanReason.length > 3
    ) {
      // Capitalize first letter
      cleanReason = cleanReason.charAt(0).toUpperCase() + cleanReason.slice(1);

      // Keep it short - max 45 chars
      if (cleanReason.length <= 45) {
        return cleanReason;
      }
      return cleanReason.substring(0, 42) + "...";
    }
  }

  // === EXTRACT FROM SHORT MESSAGE ===

  // Use shortMessage if available (from wagmi/viem)
  if (typeof error?.shortMessage === "string" && error.shortMessage.length > 0) {
    let msg = error.shortMessage
      .replace(/\n.*$/s, "") // Remove everything after first newline
      .replace(/^Contract\s+function\s+"[^"]+"\s+reverted\.?\s*/i, "")
      .replace(/^The\s+contract\s+function\s+"[^"]+"\s+reverted\.?\s*/i, "")
      .replace(/^Error:?\s*/i, "")
      .trim();

    // Skip if it's just technical details
    if (
      msg.length > 0 &&
      !msg.includes("0x") &&
      !msg.includes("execution reverted")
    ) {
      // Keep it short - max 50 chars
      if (msg.length <= 50) {
        return msg;
      }
      return msg.substring(0, 47) + "...";
    }
  }

  // === EXTRACT FROM DATA ===

  if (typeof data === "string" && data.length > 0 && data.length < 100) {
    const cleanData = data
      .replace(/^Error:?\s*/i, "")
      .trim();

    if (cleanData.length > 0 && !cleanData.includes("0x")) {
      return cleanData.length <= 50 ? cleanData : cleanData.substring(0, 47) + "...";
    }
  }

  // === FALLBACK ===

  // If we have ANY message string, try to use it
  if (typeof error?.message === "string" && error.message.length > 0) {
    const rawMessage = error.message
      .split("\n")[0] // Take first line only
      .replace(/^Error:?\s*/i, "")
      .replace(/execution reverted:?\s*/i, "")
      .trim();

    // If it's somewhat readable (not just hex or super technical)
    if (
      rawMessage.length > 0 &&
      rawMessage.length < 200 &&
      !rawMessage.startsWith("0x") &&
      !rawMessage.includes("Internal JSON-RPC error")
    ) {
      // Clean common patterns
      const cleaned = rawMessage
        .replace(/VM Exception while processing transaction:\s*/i, "")
        .replace(/err:\s*/i, "")
        .trim();

      if (cleaned.length > 0 && cleaned.length <= 50) {
        return cleaned;
      }
      if (cleaned.length > 50) {
        return cleaned.substring(0, 47) + "...";
      }
    }
  }

  // Final fallback
  return "Something went wrong. Try again.";
};
