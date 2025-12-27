import { useState, useCallback } from 'react';
import { useWalletClient, useAccount, useSwitchChain } from 'wagmi';
import { avalanche } from 'wagmi/chains';

/**
 * Hook for handling x402 payments using UVD SDK
 * Supports Avalanche C-Chain mainnet
 */
export function useX402Payment() {
  const { data: walletClient } = useWalletClient();
  const { isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Create payment header for x402 request
   * @param {Object} paymentInfo - Payment info from 402 response
   * @returns {Promise<string>} Payment header to include in request
   */
  const createPayment = useCallback(async (paymentInfo) => {
    console.log('createPayment called with:', paymentInfo);
    console.log('walletClient:', walletClient);
    console.log('isConnected:', isConnected);
    console.log('current chain:', chain);

    if (!isConnected) {
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }

    if (!walletClient) {
      throw new Error('Wallet client not ready. Please try again.');
    }

    // Check if on correct network (Avalanche C-Chain)
    if (chain?.id !== avalanche.id) {
      console.log('Switching to Avalanche...');
      try {
        await switchChain({ chainId: avalanche.id });
        // Wait a bit for the switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (switchError) {
        throw new Error('Please switch to Avalanche network in your wallet.');
      }
    }

    setLoading(true);
    setError(null);

    try {
      // x402 v1 uses 'receiver' and 'amount'
      const recipient = paymentInfo.receiver || paymentInfo.payTo;
      const amount = paymentInfo.amount || paymentInfo.maxAmountRequired;

      console.log('Creating payment (x402 v1) with:', {
        recipient,
        amount,
        network: paymentInfo.network || 'avalanche',
      });

      // Dynamic import to avoid build issues
      const { createPaymentFromWalletClient } = await import('uvd-x402-sdk/wagmi');

      const paymentHeader = await createPaymentFromWalletClient(walletClient, {
        recipient,
        amount,
        chainName: paymentInfo.network || 'avalanche',
      });

      console.log('Payment header created successfully:', paymentHeader?.substring(0, 50) + '...');
      return paymentHeader;
    } catch (err) {
      console.error('Payment creation error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [walletClient, isConnected, chain, switchChain]);

  /**
   * Make a fetch request with x402 payment handling
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Response from server
   */
  const fetchWithPayment = useCallback(async (url, options = {}) => {
    console.log('fetchWithPayment called');
    setLoading(true);
    setError(null);

    try {
      // First request - might get 402
      console.log('Making initial request to:', url);
      const response = await fetch(url, options);
      console.log('Response status:', response.status);

      if (response.status === 402) {
        // Get payment info from response (x402 v1 format)
        const data = await response.json();

        // x402 v1 uses 'paymentInfo', v2 uses 'accepts' array
        const paymentInfo = data.paymentInfo || data.accepts?.[0];

        if (!paymentInfo) {
          throw new Error('No payment info in 402 response');
        }

        console.log('Payment required (x402 v1):', paymentInfo);

        // Create payment - this should open MetaMask
        console.log('Calling createPayment...');
        const paymentHeader = await createPayment(paymentInfo);
        console.log('Got payment header, retrying request...');

        // Retry with payment header (x402 v1 uses X-PAYMENT)
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'X-PAYMENT': paymentHeader,
          },
        });

        console.log('Retry response status:', retryResponse.status);
        return retryResponse;
      }

      return response;
    } catch (err) {
      console.error('Fetch with payment error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [createPayment]);

  return {
    createPayment,
    fetchWithPayment,
    loading,
    error,
    isWalletReady: isConnected && !!walletClient,
  };
}

export default useX402Payment;
