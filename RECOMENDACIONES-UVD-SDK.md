# Recomendaciones para Mejorar uvd-x402-sdk

## Contexto

Durante la integración del protocolo x402 en Ultra Bingo (aplicación de bingo online con pagos en USDC), encontramos varios problemas que dificultaron significativamente el proceso. Este documento detalla cada problema encontrado y propone soluciones concretas para mejorar el SDK.

**Tiempo invertido en integración:** ~2 días (podría reducirse a ~2 horas con las mejoras propuestas)

---

## 1. Error "Failed to deserialize VerifyRequest"

### Problema Encontrado
El facilitador rechazaba todas las peticiones de verificación con el error "Failed to deserialize VerifyRequest". Pasamos varias horas intentando entender por qué.

### Causa Real
El facilitador (x402-rs en Rust) espera que el campo `x402Version: 1` esté en el ROOT del objeto JSON, pero no había documentación al respecto.

### Lo que enviábamos (INCORRECTO):
```javascript
{
  paymentPayload: {
    x402Version: 1,  // <-- Estaba aquí adentro
    scheme: 'exact',
    // ...
  },
  paymentRequirements: { ... }
}
```

### Lo que el facilitador esperaba (CORRECTO):
```javascript
{
  x402Version: 1,  // <-- DEBE estar aquí en el root
  paymentPayload: {
    x402Version: 1,
    scheme: 'exact',
    // ...
  },
  paymentRequirements: { ... }
}
```

### Solución Propuesta
1. Documentar este formato exacto en el README con ejemplo completo
2. Proveer una función helper que construya el objeto correctamente:

```javascript
import { buildVerifyRequest } from 'uvd-x402-sdk';

const verifyBody = buildVerifyRequest(paymentPayload, paymentRequirements);
// Esto automáticamente pone x402Version: 1 en el root
```

---

## 2. No hay Middleware de Express Incluido

### Problema Encontrado
Tuvimos que escribir ~200 líneas de código manualmente para crear el middleware, manejando:
- Interceptar rutas protegidas por pago
- Responder con HTTP 402 y paymentInfo en header
- Parsear el header X-PAYMENT del frontend
- Llamar a /verify del facilitador
- Llamar a /settle del facilitador
- Manejar todos los errores posibles

### Código que tuvimos que escribir manualmente:
Ver archivo: `bingo-backend/src/middleware/x402v2.js` (~200 líneas)

### Solución Propuesta
Incluir un middleware listo para usar:

```javascript
// Importar desde el SDK
import { x402Middleware } from 'uvd-x402-sdk/express';

// Configurar una vez
const x402 = x402Middleware({
  facilitatorUrl: 'https://facilitator.ultravioletadao.xyz',
  receiverAddress: '0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8',
  network: 'avalanche',
});

// Uso con precio fijo
app.post('/api/cards/purchase',
  x402.requirePayment({
    price: 0.001,  // en USDC (el SDK convierte a atómico)
    description: 'Compra de cartones de bingo'
  }),
  (req, res) => {
    // req.x402Payment contiene info del pago verificado
    const { transaction, amount, payer } = req.x402Payment;
    // ... lógica de negocio
  }
);

// Uso con precio dinámico basado en request
app.post('/api/cards/purchase',
  x402.requirePayment((req) => ({
    price: req.body.quantity * 0.001,
    description: `Compra de ${req.body.quantity} cartones`
  })),
  handler
);
```

---

## 3. Headers CORS No Documentados

### Problema Encontrado
Los pagos fallaban silenciosamente porque el navegador bloqueaba los headers personalizados de x402. Tuvimos que descubrir por prueba y error cuáles headers exponer y cuáles permitir.

### Headers que descubrimos que son necesarios:

**Headers que el backend debe EXPONER al frontend:**
```
PAYMENT-REQUIRED
Payment-Required
payment-required
PAYMENT-RESPONSE
Payment-Response
```

**Headers que el backend debe PERMITIR del frontend:**
```
PAYMENT-SIGNATURE
Payment-Signature
X-PAYMENT
x-payment
```

### Solución Propuesta
Documentar y proveer helper para CORS:

```javascript
import { x402CorsConfig } from 'uvd-x402-sdk';

// El SDK exporta la configuración correcta
console.log(x402CorsConfig);
// {
//   exposedHeaders: ['PAYMENT-REQUIRED', 'Payment-Required', ...],
//   allowedHeaders: ['X-PAYMENT', 'PAYMENT-SIGNATURE', ...]
// }

// Uso con cors middleware de Express:
import cors from 'cors';

app.use(cors({
  origin: 'http://localhost:5173',
  exposedHeaders: x402CorsConfig.exposedHeaders,
  allowedHeaders: [...x402CorsConfig.allowedHeaders, 'Content-Type', 'Authorization'],
}));
```

---

## 4. Cálculo de Unidades Atómicas Confuso

### Problema Encontrado
USDC tiene 6 decimales, entonces:
- 0.001 USDC = 1000 unidades atómicas
- 1 USDC = 1,000,000 unidades atómicas

Cometimos errores calculando esto manualmente y los pagos fallaban por montos incorrectos. A veces enviábamos el precio en USDC cuando debía ser atómico, o viceversa.

### Solución Propuesta
Proveer funciones de conversión claras:

```javascript
import { usdcToAtomic, atomicToUsdc } from 'uvd-x402-sdk';

// Convertir precio legible a unidades atómicas
const atomicAmount = usdcToAtomic(0.001);
// Returns: "1000" (string para evitar problemas de precisión)

// Convertir de atómico a legible
const humanAmount = atomicToUsdc("1000");
// Returns: 0.001

// También para otros tokens con diferentes decimales
import { toAtomic, fromAtomic } from 'uvd-x402-sdk';

toAtomic(1.5, { decimals: 6 });   // "1500000" (USDC)
toAtomic(1.5, { decimals: 18 });  // "1500000000000000000" (ETH)
```

---

## 5. Sin Tipos TypeScript

### Problema Encontrado
No sabíamos qué campos eran requeridos u opcionales en:
- paymentInfo
- paymentPayload
- VerifyRequest
- SettleRequest

Tuvimos que leer el código fuente del facilitador en Rust para entender la estructura esperada.

### Solución Propuesta
Incluir tipos TypeScript completos:

```typescript
// uvd-x402-sdk/types.d.ts

export interface PaymentInfo {
  x402Version: 1;
  scheme: 'exact';
  network: 'avalanche' | 'base' | 'ethereum';
  maxAmountRequired: string;  // En unidades atómicas, ej: "1000"
  resource: string;           // URL del recurso protegido
  description: string;        // Descripción para mostrar al usuario
  mimeType: string;           // Tipo de respuesta, ej: "application/json"
  payTo: string;              // Wallet que recibe el pago (checksummed)
  maxTimeoutSeconds: number;  // Tiempo máximo para completar pago
  asset: string;              // Dirección del contrato USDC
  extra?: {
    name: string;             // "USDC"
    decimals: number;         // 6
  };
}

export interface EIP3009Authorization {
  from: string;           // Wallet del pagador
  to: string;             // Wallet del receptor
  value: string;          // Monto en unidades atómicas
  validAfter: string;     // Timestamp Unix (segundos)
  validBefore: string;    // Timestamp Unix (segundos)
  nonce: string;          // Nonce único en formato hex (32 bytes)
}

export interface PaymentPayload {
  x402Version: 1;
  scheme: 'exact';
  network: string;
  payload: {
    signature: string;              // Firma EIP-3009 en hex (0x...)
    authorization: EIP3009Authorization;
  };
}

export interface VerifyRequest {
  x402Version: 1;             // IMPORTANTE: debe estar en root
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentInfo;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;     // Solo presente si isValid = false
}

export interface SettleRequest {
  x402Version: 1;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentInfo;
}

export interface SettleResponse {
  success: boolean;
  transaction?: string;       // Hash de la transacción en blockchain
  errorMessage?: string;      // Solo presente si success = false
}
```

---

## 6. Sin React Hooks

### Problema Encontrado
Tuvimos que escribir manualmente toda la lógica de pago en el frontend:
1. Hacer request inicial al backend
2. Detectar respuesta HTTP 402
3. Parsear paymentInfo del header PAYMENT-REQUIRED
4. Conectar con MetaMask
5. Construir mensaje EIP-3009
6. Solicitar firma al usuario
7. Construir paymentPayload con la firma
8. Reenviar request con header X-PAYMENT
9. Manejar errores en cada paso

### Código que tuvimos que escribir:
Ver archivo: `ultra-bingo-front/src/services/x402.js` (~150 líneas)

### Solución Propuesta
Proveer React hooks listos para usar:

```javascript
// uvd-x402-sdk/react

import { useX402, X402Provider } from 'uvd-x402-sdk/react';

// En App.jsx - Configurar provider una vez
function App() {
  return (
    <X402Provider
      facilitatorUrl="https://facilitator.ultravioletadao.xyz"
      network="avalanche"
    >
      <MyApp />
    </X402Provider>
  );
}

// En cualquier componente - Usar el hook
function BuyButton({ quantity }) {
  const {
    pay,           // Función para ejecutar pago
    isPaying,      // Boolean: pago en proceso
    error,         // Objeto error si falló
    lastPayment,   // Info del último pago exitoso
    clearError,    // Limpiar error
  } = useX402();

  const handleBuy = async () => {
    try {
      const result = await pay('/api/cards/purchase', {
        method: 'POST',
        body: { quantity }
      });

      // result contiene:
      // {
      //   success: true,
      //   data: { cards: [...] },      // Respuesta del backend
      //   transaction: '0x...',         // Hash de la transacción
      //   amount: '5000',               // Monto pagado (atómico)
      // }

      console.log('Compra exitosa:', result.data.cards);

    } catch (err) {
      // El error ya está disponible en `error` del hook
      // pero también se puede capturar aquí
      console.error('Fallo:', err.code, err.message);
    }
  };

  return (
    <div>
      <button onClick={handleBuy} disabled={isPaying}>
        {isPaying ? 'Procesando pago...' : `Comprar ${quantity} cartones`}
      </button>

      {error && (
        <div className="error">
          {error.message}
          <button onClick={clearError}>Cerrar</button>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Errores Genéricos Sin Contexto

### Problema Encontrado
Cuando algo fallaba, solo recibíamos mensajes genéricos como "Payment failed" o "Verification failed" sin poder determinar la causa:
- ¿Balance insuficiente?
- ¿Firma inválida?
- ¿Nonce ya usado?
- ¿Red incorrecta?
- ¿Facilitador caído?

### Solución Propuesta
Implementar errores con códigos específicos y contexto:

```javascript
// El SDK debería definir una clase de error estándar
class X402Error extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'X402Error';
    this.code = code;
    this.details = details;
  }
}

// Códigos de error estándar exportados por el SDK
export const X402_ERROR_CODES = {
  // Errores del usuario/wallet
  USER_REJECTED: 'USER_REJECTED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  WRONG_NETWORK: 'WRONG_NETWORK',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  WALLET_LOCKED: 'WALLET_LOCKED',

  // Errores de firma EIP-3009
  SIGNATURE_INVALID: 'SIGNATURE_INVALID',
  SIGNATURE_EXPIRED: 'SIGNATURE_EXPIRED',
  NONCE_ALREADY_USED: 'NONCE_ALREADY_USED',

  // Errores del facilitador
  FACILITATOR_UNAVAILABLE: 'FACILITATOR_UNAVAILABLE',
  FACILITATOR_TIMEOUT: 'FACILITATOR_TIMEOUT',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  SETTLEMENT_FAILED: 'SETTLEMENT_FAILED',

  // Errores de configuración
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_RECEIVER: 'INVALID_RECEIVER',
  UNSUPPORTED_NETWORK: 'UNSUPPORTED_NETWORK',
  INVALID_PAYMENT_INFO: 'INVALID_PAYMENT_INFO',
};

// Uso en el código del desarrollador:
try {
  await pay('/api/purchase', data);
} catch (err) {
  switch (err.code) {
    case 'INSUFFICIENT_BALANCE':
      alert(`Necesitas ${err.details.required} USDC pero tienes ${err.details.available}`);
      break;
    case 'WRONG_NETWORK':
      alert(`Por favor cambia a la red ${err.details.expectedNetwork}`);
      // Opcionalmente, ofrecer cambiar automáticamente
      break;
    case 'USER_REJECTED':
      // Usuario canceló, no mostrar error
      break;
    case 'NONCE_ALREADY_USED':
      // Reintentar con nuevo nonce
      await pay('/api/purchase', data);
      break;
    default:
      alert(`Error: ${err.message}`);
  }
}
```

---

## 8. Sin Verificación de Red Automática

### Problema Encontrado
Si el usuario tenía MetaMask conectado a Ethereum mainnet en lugar de Avalanche:
1. La firma se generaba sin problemas
2. El request se enviaba al backend
3. El facilitador rechazaba porque la firma era para la red incorrecta
4. El usuario no entendía qué había pasado

No había forma de detectar esto ANTES de intentar el pago.

### Solución Propuesta
Incluir verificación y cambio de red automático:

```javascript
import { ensureCorrectNetwork, getNetworkConfig } from 'uvd-x402-sdk';

// Verificar y cambiar red antes de pagar
async function handlePayment() {
  // Esto verifica la red actual y pide cambiar si es necesario
  // Lanza error si el usuario rechaza el cambio
  await ensureCorrectNetwork('avalanche');

  // Ahora sí proceder con el pago
  await pay('/api/purchase', data);
}

// O integrado automáticamente en el hook:
const { pay } = useX402({
  autoSwitchNetwork: true  // Pedir cambio de red automáticamente
});

// Obtener configuración de red (útil para mostrar al usuario)
const networkConfig = getNetworkConfig('avalanche');
// {
//   chainId: 43114,
//   chainIdHex: '0xa86a',
//   name: 'Avalanche C-Chain',
//   rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
//   blockExplorer: 'https://snowtrace.io',
//   usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
// }
```

---

## 9. Documentación del Flujo Completo

### Problema Encontrado
No había documentación clara del flujo de pago de principio a fin. Tuvimos que hacer ingeniería inversa leyendo:
- Código fuente del facilitador (Rust)
- Especificación EIP-3009
- Código de otros proyectos que usan x402

### Solución Propuesta
Incluir diagrama y explicación paso a paso en el README:

```
FLUJO DE PAGO x402 v1 - DIAGRAMA COMPLETO
==========================================

┌──────────────┐                                    ┌──────────────┐
│   FRONTEND   │                                    │   BACKEND    │
│   (React)    │                                    │  (Express)   │
└──────┬───────┘                                    └──────┬───────┘
       │                                                   │
       │  1. POST /api/purchase                            │
       │      Body: { quantity: 5 }                        │
       │ ─────────────────────────────────────────────────▶│
       │                                                   │
       │  2. HTTP 402 Payment Required                     │
       │     Header: PAYMENT-REQUIRED: <paymentInfo>       │
       │◀───────────────────────────────────────────────── │
       │                                                   │
       ▼                                                   │
┌──────────────┐                                           │
│   3. Parsear │                                           │
│   paymentInfo│                                           │
│   del header │                                           │
└──────┬───────┘                                           │
       │                                                   │
       ▼                                                   │
┌──────────────┐                                           │
│  4. Conectar │                                           │
│   MetaMask   │                                           │
└──────┬───────┘                                           │
       │                                                   │
       ▼                                                   │
┌──────────────┐                                           │
│ 5. Construir │  EIP-3009 Authorization:                  │
│   mensaje    │  - from: wallet del usuario               │
│   EIP-3009   │  - to: receiverAddress                    │
│              │  - value: monto en atómico                │
│              │  - validAfter/Before: timestamps          │
│              │  - nonce: aleatorio 32 bytes              │
└──────┬───────┘                                           │
       │                                                   │
       ▼                                                   │
┌──────────────┐                                           │
│  6. Firmar   │  eth_signTypedData_v4                     │
│  con wallet  │  (Usuario ve popup y aprueba)             │
└──────┬───────┘                                           │
       │                                                   │
       │  7. POST /api/purchase                            │
       │     Header: X-PAYMENT: <paymentPayload>           │
       │     Body: { quantity: 5 }                         │
       │ ─────────────────────────────────────────────────▶│
       │                                                   │
       │                                          ┌────────┴────────┐
       │                                          │ 8. Extraer      │
       │                                          │    X-PAYMENT    │
       │                                          │    header       │
       │                                          └────────┬────────┘
       │                                                   │
       │                                                   ▼
       │                                          ┌──────────────────┐
       │                                          │ 9. POST /verify  │
       │                                          │    al facilitador│
       │                                          └────────┬─────────┘
       │                                                   │
       │                                                   ▼
       │                                          ┌──────────────────┐
       │                                          │   FACILITADOR    │
       │                                          │   Verifica:      │
       │                                          │   - Firma válida │
       │                                          │   - Balance OK   │
       │                                          │   - Nonce único  │
       │                                          └────────┬─────────┘
       │                                                   │
       │                                                   ▼
       │                                          ┌──────────────────┐
       │                                          │ 10. POST /settle │
       │                                          │    al facilitador│
       │                                          └────────┬─────────┘
       │                                                   │
       │                                                   ▼
       │                                          ┌──────────────────┐
       │                                          │   FACILITADOR    │
       │                                          │   Ejecuta tx     │
       │                                          │   on-chain       │
       │                                          │   (transferFrom) │
       │                                          └────────┬─────────┘
       │                                                   │
       │                                          ┌────────┴────────┐
       │                                          │ 11. Procesar    │
       │                                          │     compra      │
       │                                          │     (lógica     │
       │                                          │     de negocio) │
       │                                          └────────┬────────┘
       │                                                   │
       │  12. HTTP 200 OK                                  │
       │      Body: { success: true, cards: [...] }        │
       │◀───────────────────────────────────────────────── │
       │                                                   │
       ▼                                                   │
┌──────────────┐                                           │
│ 13. Mostrar  │                                           │
│    éxito al  │                                           │
│    usuario   │                                           │
└──────────────┘                                           │
```

---

## 10. Ejemplo de Integración Completo Funcionando

### Problema Encontrado
No había ningún ejemplo completo que mostrara toda la integración de principio a fin. Solo había snippets de código aislados que no explicaban cómo conectar las piezas.

### Solución Propuesta
Crear repositorio de ejemplos `uvd-x402-sdk-examples`:

```
uvd-x402-sdk-examples/
│
├── 01-express-minimal/          # Backend mínimo (50 líneas)
│   ├── index.js                 # Servidor Express con una ruta protegida
│   ├── package.json
│   └── README.md                # Instrucciones paso a paso
│
├── 02-express-mongodb/          # Backend con persistencia
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   └── models/
│   ├── package.json
│   └── README.md
│
├── 03-react-minimal/            # Frontend mínimo (componente único)
│   ├── src/
│   │   ├── App.jsx              # Un solo componente con botón de pago
│   │   └── main.jsx
│   ├── package.json
│   └── README.md
│
├── 04-react-complete/           # Frontend completo con wallet connection
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── App.jsx
│   ├── package.json
│   └── README.md
│
├── 05-fullstack-demo/           # Proyecto completo listo para correr
│   ├── backend/
│   │   ├── src/
│   │   ├── package.json
│   │   └── .env.example
│   ├── frontend/
│   │   ├── src/
│   │   └── package.json
│   ├── docker-compose.yml       # Levantar todo con un comando
│   ├── README.md                # Instrucciones detalladas
│   └── TROUBLESHOOTING.md       # Problemas comunes y soluciones
│
└── 06-testing/                  # Cómo testear integraciones x402
    ├── mock-facilitator/        # Facilitador mock para tests
    ├── integration-tests/
    └── README.md
```

Cada ejemplo debería incluir:
1. README con instrucciones paso a paso
2. Comentarios explicativos en el código
3. Variables de entorno documentadas
4. Sección de troubleshooting

---

## Resumen de Prioridades

| Prioridad | Problema | Impacto en Desarrollador | Tiempo Perdido |
|-----------|----------|--------------------------|----------------|
| 🔴 **CRÍTICA** | x402Version en root no documentado | Bloquea completamente la integración | 4-8 horas |
| 🔴 **CRÍTICA** | Sin middleware Express | Escribir 200+ líneas manualmente | 4-6 horas |
| 🔴 **CRÍTICA** | Sin tipos TypeScript | Errores difíciles de debuggear | 2-4 horas |
| 🟡 **ALTA** | Headers CORS no documentados | Pagos fallan silenciosamente | 2-3 horas |
| 🟡 **ALTA** | Sin React hooks | Código repetitivo en cada proyecto | 3-4 horas |
| 🟡 **ALTA** | Errores genéricos sin contexto | No saber qué falló | 2-3 horas |
| 🟢 **MEDIA** | Sin helpers de conversión atómica | Errores de cálculo de montos | 1-2 horas |
| 🟢 **MEDIA** | Sin verificación de red | UX confusa para usuarios | 1 hora |
| 🟢 **BAJA** | Sin ejemplos completos | Curva de aprendizaje alta | 2-4 horas |
| 🟢 **BAJA** | Sin diagrama de flujo | Difícil entender el protocolo | 1-2 horas |

**Tiempo total perdido estimado: 20-35 horas**

Con las mejoras propuestas, la integración podría completarse en **2-4 horas**.

---

## Información de Contacto

Este documento fue generado basándose en la experiencia real de integración del proyecto **Ultra Bingo** para UltravioletaDAO.

- **Proyecto:** Ultra Bingo (Bingo online con pagos USDC)
- **Red utilizada:** Avalanche C-Chain
- **Facilitador:** https://facilitator.ultravioletadao.xyz
- **Fecha de integración:** Diciembre 2024

---

## Anexo: Código que Tuvimos que Escribir Manualmente

Para referencia, estos son los archivos que tuvimos que crear desde cero porque el SDK no los incluía:

### Backend: Middleware x402 (~200 líneas)
Archivo: `bingo-backend/src/middleware/x402v2.js`

### Frontend: Cliente x402 (~150 líneas)
Archivo: `ultra-bingo-front/src/services/x402.js`

Estos archivos pueden servir como base para crear los helpers del SDK.
