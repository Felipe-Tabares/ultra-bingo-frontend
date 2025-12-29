/**
 * Servicio x402 para manejar pagos con el protocolo x402
 *
 * Basado en la implementación funcional de UltrapayX402
 * Usa viem directamente con window.ethereum para máxima compatibilidad
 */

import { createWalletClient, custom, toHex } from 'viem';
import { avalanche, base } from 'viem/chains';
import { config } from '../config';

// Estado global de la wallet
let walletClient = null;

/**
 * Verifica si hay una wallet instalada (MetaMask, etc.)
 */
export function hasWalletProvider() {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

/**
 * Obtiene la chain correcta según la configuración
 */
function getChain() {
  return config.x402?.network === 'base' ? base : avalanche;
}

/**
 * Conecta con la wallet del usuario
 */
export async function connectWallet(forceNewConnection = true) {
  if (!hasWalletProvider()) {
    throw new Error('No se encontró una wallet. Instala MetaMask.');
  }

  try {
    if (forceNewConnection) {
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch (permError) {
        console.log('Permission request failed, falling back to eth_requestAccounts');
      }
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No se pudo conectar con la wallet');
    }

    const address = accounts[0];

    // Crear wallet client con viem
    walletClient = createWalletClient({
      account: address,
      chain: getChain(),
      transport: custom(window.ethereum),
    });

    const chainId = await window.ethereum.request({
      method: 'eth_chainId',
    });

    return {
      isConnected: true,
      address,
      chainId: parseInt(chainId, 16),
    };
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
}

/**
 * Obtiene el estado actual de la wallet
 */
export async function getWalletState() {
  if (!hasWalletProvider()) {
    return {
      isConnected: false,
      address: null,
      chainId: null,
      balance: null,
    };
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts',
    });

    if (!accounts || accounts.length === 0) {
      return {
        isConnected: false,
        address: null,
        chainId: null,
        balance: null,
      };
    }

    const address = accounts[0];
    const chainId = await window.ethereum.request({
      method: 'eth_chainId',
    });

    return {
      isConnected: true,
      address,
      chainId: parseInt(chainId, 16),
      balance: null,
    };
  } catch {
    return {
      isConnected: false,
      address: null,
      chainId: null,
      balance: null,
    };
  }
}

/**
 * Cambia a la red correcta para x402 (Base Sepolia para testnet)
 */
export async function switchToCorrectNetwork() {
  if (!hasWalletProvider()) {
    throw new Error('No wallet provider found');
  }

  const targetChain = getChain();
  const targetChainIdHex = `0x${targetChain.id.toString(16)}`;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainIdHex }],
    });
    return true;
  } catch (switchError) {
    // Si la chain no está añadida, intentar añadirla
    if (switchError?.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: targetChainIdHex,
              chainName: targetChain.name,
              nativeCurrency: targetChain.nativeCurrency,
              rpcUrls: [targetChain.rpcUrls.default.http[0]],
              blockExplorerUrls: [targetChain.blockExplorers?.default.url],
            },
          ],
        });
        return true;
      } catch {
        throw new Error(`No se pudo añadir la red ${targetChain.name}`);
      }
    }
    throw switchError;
  }
}

/**
 * Asegura que el walletClient esté inicializado con account
 */
async function ensureWalletClient() {
  if (!hasWalletProvider()) {
    throw new Error('No wallet provider found');
  }

  const accounts = await window.ethereum.request({
    method: 'eth_accounts',
  });

  if (!accounts || accounts.length === 0) {
    throw new Error('Wallet not connected');
  }

  const address = accounts[0];

  // Siempre recrear walletClient con el account actual
  walletClient = createWalletClient({
    account: address,
    chain: getChain(),
    transport: custom(window.ethereum),
  });

  return walletClient;
}

/**
 * Genera un nonce aleatorio para la autorización
 */
function generateNonce() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return toHex(randomBytes);
}

/**
 * Firma una autorización de pago usando EIP-3009 (TransferWithAuthorization)
 */
export async function signPaymentAuthorization(paymentInfo, amount) {
  console.log('[x402] Iniciando firma de autorización...');

  let client;
  try {
    client = await ensureWalletClient();
  } catch (err) {
    console.error('[x402] Error obteniendo wallet client:', err);
    throw new Error('No se pudo conectar con la wallet: ' + err.message);
  }

  if (!client.account) {
    console.error('[x402] No hay cuenta en el wallet client');
    throw new Error('Wallet account not available');
  }

  const address = client.account.address;
  const chain = getChain();
  console.log('[x402] Dirección de wallet:', address);
  console.log('[x402] Chain objetivo:', chain.name, '(', chain.id, ')');

  // Verificar que la wallet esté en la red correcta antes de firmar
  let currentChainId;
  try {
    currentChainId = await window.ethereum.request({
      method: 'eth_chainId',
    });
  } catch (err) {
    console.error('[x402] Error obteniendo chainId:', err);
    throw new Error('No se pudo obtener la red actual de la wallet');
  }

  const currentChainIdNum = parseInt(currentChainId, 16);
  console.log('[x402] Chain actual:', currentChainIdNum);

  if (currentChainIdNum !== chain.id) {
    console.log('[x402] Cambiando a red correcta...');
    try {
      await switchToCorrectNetwork();
    } catch (err) {
      console.error('[x402] Error cambiando de red:', err);
      throw new Error('No se pudo cambiar a la red ' + chain.name);
    }

    // Reinicializar walletClient con la nueva red
    walletClient = createWalletClient({
      account: address,
      chain: chain,
      transport: custom(window.ethereum),
    });
    console.log('[x402] Wallet client reinicializado para nueva red');
  }

  // Tiempos de validez
  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 60); // Válido desde hace 1 minuto
  const validBefore = BigInt(now + (paymentInfo.maxTimeoutSeconds || 300) + 300); // Válido por el timeout + 5 minutos extra

  // Generar nonce aleatorio
  const authorizationNonce = generateNonce();

  // USDC contract address por chain
  const usdcAddresses = {
    43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // Avalanche USDC
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
    84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  };
  const usdcAddress = usdcAddresses[chain.id] || usdcAddresses[43114];

  // EIP-712 Domain para USDC
  const domain = {
    name: paymentInfo.extra?.name || 'USD Coin',
    version: paymentInfo.extra?.version || '2',
    chainId: chain.id,
    verifyingContract: usdcAddress,
  };

  // Tipos EIP-712 para TransferWithAuthorization (EIP-3009)
  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  // Obtener receiver (v1) o payTo (v2)
  const recipient = paymentInfo.receiver || paymentInfo.payTo;

  // Mensaje a firmar
  const message = {
    from: address,
    to: recipient,
    value: amount,
    validAfter: validAfter,
    validBefore: validBefore,
    nonce: authorizationNonce,
  };

  console.log('[x402] Preparando firma EIP-712:');
  console.log('[x402]   Domain:', domain);
  console.log('[x402]   From:', address);
  console.log('[x402]   To:', recipient);
  console.log('[x402]   Value:', amount.toString());

  // Firmar con EIP-712
  const signingClient = walletClient || client;
  console.log('[x402] Solicitando firma a la wallet (MetaMask debería abrirse)...');

  let signature;
  try {
    signature = await signingClient.signTypedData({
      account: signingClient.account,
      domain,
      types,
      primaryType: 'TransferWithAuthorization',
      message,
    });
    console.log('[x402] Firma obtenida:', signature.substring(0, 20) + '...');
  } catch (signErr) {
    console.error('[x402] Error al firmar:', signErr);
    if (signErr.code === 4001 || signErr.message?.includes('rejected') || signErr.message?.includes('denied')) {
      throw new Error('User rejected the signature request');
    }
    throw signErr;
  }

  // Construir el payload x402 v1 (compatible con uvd-x402-sdk)
  const paymentPayload = {
    x402Version: 1,
    scheme: paymentInfo.scheme,
    network: paymentInfo.network || 'avalanche',
    payload: {
      signature: signature,
      authorization: {
        from: address,
        to: recipient,
        value: amount.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce: authorizationNonce,
      },
    },
  };

  console.log('[x402] Payload de pago construido exitosamente');
  return paymentPayload;
}

/**
 * Codifica el payload de pago para el header X-Payment
 */
export function encodePaymentHeader(payload) {
  const jsonStr = JSON.stringify(payload);
  return btoa(jsonStr);
}

/**
 * Crea un fetch wrapper con soporte para pagos x402
 *
 * Flujo:
 * 1. Envía request sin pago
 * 2. Si recibe 402, lee el body JSON con la info de pago
 * 3. Abre wallet para que usuario firme la autorización
 * 4. Reenvía request con header X-Payment
 */
export async function createPaymentFetch() {
  // Asegurar que walletClient esté inicializado
  await ensureWalletClient();

  // Retornar un fetch wrapper que maneja 402 automáticamente
  return async (input, init) => {
    console.log('[x402] Iniciando petición a:', input);

    // Primera petición sin header de pago
    const firstResponse = await fetch(input, init);
    console.log('[x402] Primera respuesta status:', firstResponse.status);

    // Si no es 402, retornar la respuesta directamente
    if (firstResponse.status !== 402) {
      return firstResponse;
    }

    // Leer la información de pago del body JSON
    let x402Data;
    try {
      x402Data = await firstResponse.json();
      console.log('[x402] Datos de pago recibidos:', x402Data);
    } catch (error) {
      console.error('[x402] Error leyendo datos de pago:', error);
      throw new Error('No se pudo leer la información de pago del servidor');
    }

    // Validar que tengamos la info de pago (v1: paymentInfo, v2: accepts)
    const paymentInfo = x402Data.paymentInfo || x402Data.accepts?.[0];

    if (!paymentInfo) {
      console.error('[x402] No se encontró paymentInfo en:', x402Data);
      throw new Error('El servidor no proporcionó información de pago válida');
    }

    // Convertir el monto (ya viene en unidades atómicas)
    const amount = BigInt(paymentInfo.amount || paymentInfo.maxAmountRequired);
    console.log('[x402] Monto a pagar:', amount.toString(), '(', Number(amount) / 1_000_000, 'USDC)');

    // Firmar la autorización de pago - esto abre la wallet para que el usuario confirme
    console.log('[x402] Solicitando firma al usuario...');
    let paymentPayload;
    try {
      paymentPayload = await signPaymentAuthorization(paymentInfo, amount);
      console.log('[x402] Firma obtenida exitosamente');
    } catch (signError) {
      console.error('[x402] Error en firma:', signError);
      throw signError;
    }

    // Codificar el payload para el header X-Payment
    const paymentHeader = encodePaymentHeader(paymentPayload);
    console.log('[x402] Header X-PAYMENT preparado, longitud:', paymentHeader.length);

    // Segunda petición con header de pago x402 v1
    const newHeaders = new Headers(init?.headers);
    newHeaders.set('X-PAYMENT', paymentHeader);

    console.log('[x402] Enviando segunda petición con pago...');
    const secondResponse = await fetch(input, {
      ...init,
      headers: newHeaders,
    });
    console.log('[x402] Segunda respuesta status:', secondResponse.status);

    // Si la segunda respuesta también es 402, loguear el error
    if (secondResponse.status === 402) {
      const errorBody = await secondResponse.clone().json().catch(() => ({}));
      console.error('[x402] Pago rechazado por el servidor:', errorBody);
    }

    return secondResponse;
  };
}

/**
 * Hook-like function para usar en componentes React
 * Retorna funciones para manejar pagos x402
 */
export async function getX402Functions() {
  const walletState = await getWalletState();

  if (!walletState.isConnected) {
    return {
      paymentFetch: null,
      isReady: false,
      walletState,
    };
  }

  try {
    const paymentFetch = await createPaymentFetch();
    return {
      paymentFetch,
      isReady: true,
      walletState,
    };
  } catch (error) {
    console.error('[x402] Error creating payment fetch:', error);
    return {
      paymentFetch: null,
      isReady: false,
      walletState,
      error: error.message,
    };
  }
}

export default {
  hasWalletProvider,
  connectWallet,
  getWalletState,
  switchToCorrectNetwork,
  signPaymentAuthorization,
  encodePaymentHeader,
  createPaymentFetch,
  getX402Functions,
};
