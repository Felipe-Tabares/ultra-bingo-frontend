# Ultra Bingo - Proyecto de Bingo Online para UltravioletaDAO

## Resumen del Proyecto

Desarrollo de una plataforma de bingo online para la comunidad de UltravioletaDAO. El sistema permite comprar cartones de bingo mediante pagos crypto usando el protocolo x402 y jugar en tiempo real con transmision en vivo de los numeros sorteados.

---

## Estructura del Proyecto

El proyecto esta dividido en dos repositorios:

| Repositorio | Ruta | Tecnologia |
|-------------|------|------------|
| **Frontend** | `C:\Users\Felipe\Desktop\ultra-bingo-front` | React.js + Vite |
| **Backend** | `C:\Users\Felipe\Desktop\bingo-backend` | Node.js + Express + WebSockets + MongoDB |

---

## Configuracion Actual

### Backend (.env)
```env
NODE_OPTIONS=--dns-result-order=ipv4first

# MongoDB
MONGODB_URI=mongodb+srv://bingo:ultrabingo@cluster0.uv3iiou.mongodb.net/ultrabingo?retryWrites=true&w=majority

# x402 Configuration
X402_FACILITATOR_URL=https://facilitator.ultravioletadao.xyz
X402_NETWORK=avalanche
X402_RECEIVER_ADDRESS=0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8

# Bingo
CARD_PRICE=0.001

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### Frontend (config/index.js)
```javascript
export const config = {
  apiUrl: 'http://localhost:5000',
  wsUrl: 'http://localhost:5000',
  x402: {
    facilitatorUrl: 'https://facilitator.ultravioletadao.xyz',
    network: 'avalanche',
    receiverAddress: '0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8',
  },
  cardPrice: 0.001,
  maxCardsPerPurchase: 10,
};
```

---

## Flujo de Usuario

### 1. Compra de Cartones (ACTUALIZADO)
1. Usuario entra a la web
2. **Selecciona cantidad de cartones (1-10) con selector visual**
3. Ve el precio total calculado en tiempo real
4. Hace clic en "Comprar cartones"
5. Se procesa el pago mediante protocolo x402 con USDC en Avalanche
6. **Se asignan cartones aleatorios automaticamente**
7. **Se muestran los cartones comprados con todos sus numeros**

### 2. Bingo en Vivo (Bingo Live)
1. Usuario accede a la seccion "Bingo Live"
2. Ve el carton publico del bingo en tiempo real
3. El administrador marca los numeros que van saliendo
4. Los numeros se tachan visualmente con un sello/marca
5. Actualizacion en tiempo real mediante WebSockets

---

## Integracion x402 (Pagos Crypto) - ACTUALIZADO

### Red Actual: Avalanche Mainnet
- **Chain ID**: 43114
- **USDC Address**: `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`
- **Receiver**: `0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8`
- **Facilitador**: `https://facilitator.ultravioletadao.xyz`

### Flujo de Pago x402 v1
1. Frontend envia request a `/api/cards/purchase` con `quantity`
2. Backend responde con 402 + `paymentInfo` (formato v1)
3. Frontend firma autorizacion EIP-3009 con MetaMask
4. Frontend reenvia request con header `X-PAYMENT`
5. Backend verifica con facilitador `/verify`
6. Backend ejecuta pago con facilitador `/settle`
7. Cartones asignados al usuario

### Formato de VerifyRequest (x402 v1)
```javascript
{
  x402Version: 1,
  paymentPayload: {
    x402Version: 1,
    scheme: 'exact',
    network: 'avalanche',
    payload: {
      signature: '0x...',
      authorization: {
        from: '0x...',
        to: '0x...',
        value: '1000',
        validAfter: '...',
        validBefore: '...',
        nonce: '0x...'
      }
    }
  },
  paymentRequirements: {
    scheme: 'exact',
    network: 'avalanche',
    maxAmountRequired: '1000',
    payTo: '0x...',
    asset: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
  }
}
```

---

## Base de Datos MongoDB

### Conexion
- **Cluster**: MongoDB Atlas
- **Database**: `ultrabingo`
- **URI**: En variable de entorno `MONGODB_URI`

### Modelos

#### Card (src/models/Card.js)
```javascript
{
  cardId: String,           // "card_uuid" - unico
  numbers: {                // Numeros del carton 5x5
    B: [Number],
    I: [Number],
    N: [Number],
    G: [Number],
    O: [Number],
  },
  status: 'available' | 'purchased' | 'expired',
  owner: String,            // ID del usuario
  ownerUsername: String,    // Nombre de usuario
  ownerWallet: String,      // Wallet del comprador
  purchaseTxHash: String,   // Hash de transaccion x402
  pricePaid: String,        // Precio en USDC atomico
  purchasedAt: Date,
  createdAt: Date,
}
```

#### User (src/models/User.js)
```javascript
{
  odId: String,             // "user_0x..." - ID basado en wallet
  username: String,         // Nombre elegido por usuario
  wallet: String,           // Wallet address (lowercase)
  isAdmin: Boolean,         // Flag de admin
  stats: {
    gamesPlayed: Number,
    gamesWon: Number,
    cardsPurchased: Number,
    totalSpent: String,     // USDC atomico
    totalWon: String,
  },
  lastLoginAt: Date,
  createdAt: Date,
}
```

#### Game (src/models/Game.js)
```javascript
{
  gameId: String,           // "game_timestamp"
  status: 'waiting' | 'playing' | 'paused' | 'ended',
  calledNumbers: [Number],  // Numeros sorteados
  currentNumber: Number,    // Ultimo numero
  winner: String,           // ID del ganador
  startedAt: Date,
  endedAt: Date,
}
```

---

## API Endpoints (Backend)

### Publicos
```
GET  /api/cards/available     - Obtener cartones disponibles
POST /api/cards/purchase      - Comprar cartones (protegido por x402)
     Body: { quantity: Number, wallet: String }
     Response: { success, cards: [...], transaction }
GET  /api/cards/my-cards      - Obtener mis cartones (requiere auth)
GET  /api/game/current        - Estado actual del juego
```

### Auth
```
POST /api/auth/register       - Registrar/login usuario
     Body: { username: String, wallet: String }
     Response: { success, user, token }
GET  /api/auth/me             - Obtener usuario actual
GET  /api/auth/cards          - Obtener cartones del usuario
```

### Admin (Requieren JWT + isAdmin)
```
POST /api/admin/login         - Iniciar sesion admin
POST /api/admin/game/start    - Iniciar juego
POST /api/admin/game/call     - Llamar numero
POST /api/admin/game/pause    - Pausar juego
POST /api/admin/game/end      - Terminar juego
```

---

## Componentes Frontend Clave

### CardQuantitySelector (NUEVO)
**Ubicacion**: `src/components/bingo/CardQuantitySelector.jsx`

Selector visual de cantidad de cartones:
- Botones +/- para ajustar cantidad (1-10)
- Botones de seleccion rapida (1, 3, 5, 10)
- Representacion visual de cartones apilados
- Precio total calculado en tiempo real
- Despues de comprar, muestra los cartones asignados con todos sus numeros

```jsx
<CardQuantitySelector
  onPurchase={handlePurchase}      // Recibe quantity
  purchasing={boolean}
  isLoggedIn={boolean}
  purchasedCards={[]}              // Cartones comprados para mostrar
  onClearPurchased={function}      // Limpiar y comprar mas
/>
```

### Home.jsx (ACTUALIZADO)
- Usa `CardQuantitySelector` en lugar de mostrar todos los cartones
- Envia `quantity` al backend (no IDs especificos)
- Muestra los cartones comprados despues del pago exitoso
- Estado `purchasedCards` para almacenar cartones recibidos

---

## Estructura de Archivos Frontend

```
ultra-bingo-front/
├── src/
│   ├── components/
│   │   ├── bingo/
│   │   │   ├── BingoCard.jsx
│   │   │   ├── NumberBall.jsx
│   │   │   ├── CardQuantitySelector.jsx    # NUEVO
│   │   │   ├── CardQuantitySelector.css    # NUEVO
│   │   │   └── index.js
│   │   ├── layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── Layout.jsx
│   │   └── ui/
│   │       ├── LoginModal.jsx
│   │       ├── GlowButton.jsx
│   │       ├── GlassCard.jsx
│   │       └── AnimatedBackground.jsx
│   ├── config/
│   │   └── index.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── SocketContext.jsx
│   ├── pages/
│   │   ├── Home.jsx                         # Actualizado
│   │   ├── BingoLive.jsx
│   │   ├── MyCards.jsx
│   │   └── Admin.jsx
│   ├── services/
│   │   └── x402.js                          # Cliente x402 para pagos
│   ├── App.jsx
│   └── main.jsx
├── CONTEXTO.md
└── package.json
```

## Estructura de Archivos Backend

```
bingo-backend/
├── src/
│   ├── config/
│   │   └── index.js
│   ├── db/
│   │   └── connection.js                    # Conexion MongoDB
│   ├── models/
│   │   ├── Card.js                          # Modelo de carton
│   │   ├── User.js                          # Modelo de usuario
│   │   ├── Game.js                          # Modelo de juego
│   │   └── index.js
│   ├── middleware/
│   │   ├── auth.js                          # JWT verification
│   │   └── x402v2.js                        # x402 payment middleware
│   ├── routes/
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── cards.js                         # Actualizado para quantity
│   │   └── game.js
│   ├── services/
│   │   ├── bingoCard.js
│   │   ├── gameState.js                     # Migrado a MongoDB
│   │   └── socket.js
│   └── index.js
├── .env
└── package.json
```

---

## Estado del Desarrollo

### Completado
- [x] Frontend React + Vite
- [x] Backend Node.js + Express + Socket.io
- [x] Sistema de login (username + wallet)
- [x] Panel de administrador
- [x] WebSockets para tiempo real
- [x] **MongoDB para persistencia**
- [x] **x402 v1 con UltravioletaDAO en Avalanche**
- [x] **Sistema de compra por cantidad (no seleccion manual)**
- [x] **CardQuantitySelector component**
- [x] **Cartones asociados a usuario (owner, ownerUsername, ownerWallet)**
- [x] **Modos de juego ULTRA (fullCard, letterU, letterL, letterT, letterR, letterA, line, corners)**
- [x] **Verificacion automatica de ganadores con pausa de juego**
- [x] **Sistema de aceptar/rechazar ganador para admin**
- [x] **Historial de ganadores (modelo Winner + componente WinnersHistory)**
- [x] **Rate limiting en WebSockets para eventos admin**
- [x] **Busqueda de cartones por ID (parcial)**
- [x] **Audit logging para seguridad**

### Pendiente
- [ ] Sistema de premios (pool y distribucion)
- [ ] Testing
- [ ] Despliegue AWS (Terraform)

---

## Whitelist de Administradores

### Wallet Admin Actual
```
0x13ef1f97a3De80CEE38ca77267795a635798C101
```

### Configuracion
- **Backend**: `ADMIN_WALLETS` en `.env` (separadas por comas)
- **Logica**: Al registrarse, se verifica si wallet esta en whitelist

---

## Referencias

- **UltravioletaDAO Web**: https://ultravioletadao.xyz/
- **Facilitador x402**: https://facilitator.ultravioletadao.xyz/
- **x402 Protocol**: https://github.com/coinbase/x402
- **USDC Avalanche**: https://snowtrace.io/token/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E

---

## Comandos de Desarrollo

### Frontend
```bash
cd C:\Users\Felipe\Desktop\ultra-bingo-front
npm run dev
# Corre en http://localhost:5173
```

### Backend
```bash
cd C:\Users\Felipe\Desktop\bingo-backend
npm run dev
# Corre en http://localhost:5000
```

---

## Notas Importantes

1. **x402 usa formato v1** compatible con uvd-x402-sdk y el facilitador de UltravioletaDAO
2. **Red: Avalanche mainnet** (chainId 43114) - NO Base Sepolia
3. **Precio**: 0.001 USDC por carton (1000 unidades atomicas)
4. **Cartones se asignan aleatoriamente** - usuario NO elige numeros especificos
5. **MongoDB Atlas** para persistencia de datos
6. **FREE space representado como 0** - En la columna N, posicion central es 0 (no string "FREE")

---

## Bugs Resueltos y Soluciones

### 1. Error "Failed to deserialize VerifyRequest"
**Causa**: El facilitador x402-rs esperaba `x402Version: 1` en el root del VerifyRequest.
**Solucion**: Actualizar `x402v2.js` para incluir `x402Version: 1` en el objeto raiz del verifyBody.

### 2. Error "Card is not available" despues de pago exitoso
**Causa**: Cartones almacenados en memoria se perdian al reiniciar el servidor.
**Solucion**: Migracion completa a MongoDB Atlas para persistencia.

### 3. Error "Inserted 0 cards into MongoDB"
**Causa**: El generador de cartones usaba `'FREE'` (string) para el espacio central, pero el modelo MongoDB definia `N: [Number]`.
**Solucion**: Cambiar `'FREE'` por `0` en `bingoCard.js`. El valor 0 representa el espacio libre.

**Archivos modificados**:
- `src/services/bingoCard.js` - Usar 0 en lugar de 'FREE'
- `src/components/bingo/CardQuantitySelector.jsx` - Mostrar '*' cuando num === 0

### 4. Error "next is not a function" en User.pre('save')
**Causa**: Mongoose moderno no requiere callback `next` en hooks sincronos.
**Solucion**: Remover parametro `next` del hook pre('save') en User.js.

```javascript
// ANTES (error)
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// DESPUES (correcto)
UserSchema.pre('save', function() {
  this.updatedAt = new Date();
});
```

### 5. Error 500 aunque la compra fue exitosa
**Causa**: El error en `incrementUserStats` (por el bug de next) causaba 500 aunque los cartones ya se habian comprado.
**Solucion**: Envolver actualizacion de stats en try/catch separado para que no falle la compra.

```javascript
// Update user stats (non-critical)
try {
  await gameState.incrementUserStats(userId, 'cardsPurchased', purchasedCards.length);
} catch (statsErr) {
  console.error('Error updating user stats (non-critical):', statsErr.message);
}
// La respuesta se envia aunque falle stats
```

### 6. Campo pricePaid guardado como null
**Causa**: El facilitador no devuelve el amount en `settleResult`, por lo que `paymentInfo.settleResult?.amount` era null.
**Solucion**: Calcular el precio basado en la cantidad de cartones * precio por carton.

```javascript
// ANTES (null)
const pricePaid = paymentInfo.settleResult?.amount || null;

// DESPUES (calculado)
const pricePerCard = Math.round(config.cardPrice * 1_000_000); // atomic units
const pricePaid = (cardsToAssign.length * pricePerCard).toString();
```

**Archivo**: `src/routes/cards.js`

---

## Generacion de Cartones

### Estructura de Numeros
```javascript
{
  B: [3, 7, 11, 2, 14],      // 1-15
  I: [22, 18, 29, 16, 25],   // 16-30
  N: [31, 44, 0, 38, 42],    // 31-45, centro = 0 (FREE)
  G: [49, 55, 60, 47, 52],   // 46-60
  O: [63, 71, 68, 75, 62]    // 61-75
}
```

### Logging de Generacion
El sistema ahora muestra logs detallados:
```
[GameState] Available cards count: 49, minimum required: 20
[GameState] Final available cards: 49
```

---

## Transacciones Exitosas de Prueba

| TX Hash | Red | Monto | Estado |
|---------|-----|-------|--------|
| `0xfb2f6cf0d4268b9e7b696ff2836a669a7139f8479ceabc4d1d320cc6fcbc702a` | Avalanche | 0.001 USDC | Exitosa |
| `0x26ae36d2f7a95a951435d20ba727629664d5202c3d4be7fdd5ec68ff89886932` | Avalanche | 0.001 USDC | Exitosa |
| `0x1adcf8295dc63d83c9125c7726d89696755c710e740a595098a8bbc0b9b895ef` | Avalanche | 0.001 USDC | Exitosa |

Ver en: https://snowscan.xyz/tx/{hash}

---

## Tema Navideño (Diciembre 2024)

### Paleta de Colores Navideños
| Color | Hex | Uso |
|-------|-----|-----|
| **Rojo Navideño** | `#c41e3a`, `#8b0000` | Botones principales, acentos |
| **Verde Navideño** | `#228b22`, `#006400` | Botones secundarios, acentos |
| **Dorado** | `#ffd700`, `#daa520` | Bordes, highlights, textos importantes |
| **Blanco/Nieve** | `#ffffff` | Particulas, efectos de nieve |

### Fondos Degradados
```css
/* Fondo oscuro navideño */
background: linear-gradient(135deg, rgba(20, 35, 20, 0.9), rgba(40, 20, 20, 0.9));
```

### Luces Navideñas Animadas (Header/Footer)
```css
.header-border, .footer-border {
  height: 4px;
  background: repeating-linear-gradient(
    90deg,
    #c41e3a 0px, #c41e3a 15px,
    #228b22 15px, #228b22 30px,
    #ffd700 30px, #ffd700 45px
  );
  animation: lights-move 3s linear infinite;
}

@keyframes lights-move {
  0% { background-position: 0 0; }
  100% { background-position: 45px 0; }
}
```

### Colores de Columnas BINGO
```javascript
const COLUMN_COLORS = {
  B: '#c41e3a',  // Rojo
  I: '#228b22',  // Verde
  N: '#ffd700',  // Dorado
  G: '#c41e3a',  // Rojo
  O: '#228b22',  // Verde
};
```

### Emojis Navideños Usados
| Emoji | Uso |
|-------|-----|
| 🎄 | Arbol de navidad - Navegacion, decoracion |
| 🎅 | Santa - Titulo, footer |
| 🎁 | Regalo - Navegacion, seccion cartones |
| ⭐ | Estrella - Decoracion flotante |
| 🔔 | Campana - Decoracion flotante |
| ❄️ | Copo de nieve - Decoracion, footer |
| 👑 | Corona - Panel de admin |

### Archivos CSS Modificados con Tema Navideño
- `src/pages/Home.css` - Hero section, decoraciones flotantes
- `src/pages/BingoLive.css` - Tablero, panel admin, numeros recientes
- `src/components/layout/Header.css` - Luces animadas, colores
- `src/components/layout/Footer.css` - Luces animadas, colores
- `src/components/bingo/CardQuantitySelector.css` - Botones, tarjetas
- `src/components/ui/GlowButton.css` - Botones rojo/verde
- `src/components/ui/GlassCard.css` - Bordes degradado navideño
- `src/components/ui/AnimatedBackground.css` - Orbes de colores

### Archivos JSX Modificados
- `src/pages/Home.jsx` - Emojis en titulo, decoraciones flotantes
- `src/pages/BingoLive.jsx` - Colores BINGO, emojis de seccion
- `src/components/layout/Header.jsx` - Iconos navideños en navegacion
- `src/components/layout/Footer.jsx` - Emojis, texto "Feliz Navidad"
- `src/components/ui/AnimatedBackground.jsx` - Particulas rojo/verde/dorado/blanco

### Particulas del Fondo (AnimatedBackground.jsx)
```javascript
const christmasColors = [
  { h: 0, s: 80, l: 50 },    // Rojo
  { h: 120, s: 60, l: 35 },  // Verde
  { h: 45, s: 100, l: 50 },  // Dorado
  { h: 0, s: 0, l: 100 },    // Blanco (nieve)
];
```

---

## Bugs Resueltos (Session Actual)

### 7. BingoLive no cargaba (solo fondo morado)
**Error**: `Cannot read properties of undefined (reading 'length')` en `calledNumbers`
**Causa**: `gameState` era undefined antes de que el socket se conectara.
**Solucion**: Agregar valores por defecto con destructuring seguro.

```javascript
// ANTES (crash)
const { status, calledNumbers, currentNumber, winner } = gameState;

// DESPUES (seguro)
const { status = 'waiting', calledNumbers = [], currentNumber = null, winner = null } = gameState || {};
```

**Archivo**: `src/pages/BingoLive.jsx:91`

### 8. Botones +/- no visibles en CardQuantitySelector
**Causa**: Faltaban estilos de color explicitos para los botones.
**Solucion**: CSS actualizado con colores navideños y tamaño 56px.

### 9. Conflicto de wallets Core/MetaMask
**Mensaje**: "Core was elected as the current provider, replacing MetaMask"
**Naturaleza**: NO es un error critico, solo informativo. Las extensiones de wallet compiten por `window.ethereum`.
**Solucion**: Ignorar - el sistema funciona correctamente

---

## Sistema de Seguridad (Implementado 25 Dic 2024)

### 1. Autenticacion de Socket Endurecida
**Archivo**: `bingo-backend/src/services/socket.js`

```javascript
io.use((socket, next) => {
  // CRITICAL: Explicitly set isAdmin to false by default
  socket.isAdmin = false;
  socket.userId = null;
  socket.authenticated = false;

  // ... verificacion JWT ...

  // SECURITY: Only grant admin if token has isAdmin AND wallet is in whitelist
  if (decoded.isAdmin === true) {
    const wallet = decoded.wallet?.toLowerCase();
    const isWhitelisted = wallet && config.adminWallets.includes(wallet);
    if (isWhitelisted) {
      socket.isAdmin = true;
    }
  }
});
```

**Protecciones**:
- `socket.isAdmin = false` explicito para prevenir bypasses con undefined
- Doble verificacion: token JWT + wallet en whitelist
- Logs detallados de intentos de autenticacion

### 2. Randomness Criptografico para Cartones
**Archivo**: `bingo-backend/src/services/bingoCard.js`

```javascript
import crypto from 'crypto';

// Genera entero aleatorio criptograficamente seguro
function secureRandomInt(max) {
  const bytesNeeded = Math.ceil(Math.log2(max) / 8) || 1;
  const maxValid = Math.floor(256 ** bytesNeeded / max) * max;

  let randomValue;
  do {
    const bytes = crypto.randomBytes(bytesNeeded);
    randomValue = bytes.reduce((acc, byte, i) => acc + byte * (256 ** i), 0);
  } while (randomValue >= maxValid);

  return randomValue % max;
}

// Fisher-Yates shuffle con crypto
function secureShuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

**Reemplaza**: `Math.random()` (predecible) con `crypto.randomBytes()` (impredecible)

### 3. Hash de Integridad de Cartones
**Archivo**: `bingo-backend/src/services/bingoCard.js`

```javascript
function generateCardHash(cardId, numbers, createdAt) {
  const secret = config.jwtSecret;
  const data = JSON.stringify({ cardId, numbers, createdAt });
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyCardIntegrity(card) {
  if (!card || !card.id || !card.numbers || !card.created_at || !card.hash) {
    return false;
  }
  const expectedHash = generateCardHash(card.id, card.numbers, card.created_at);
  return crypto.timingSafeEqual(
    Buffer.from(card.hash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}
```

**Protecciones**:
- Cada carton incluye HMAC-SHA256
- Verificacion timing-safe para prevenir timing attacks
- Detecta manipulacion de cartones

### 4. Middleware de Seguridad
**Archivo**: `bingo-backend/src/middleware/security.js`

#### Rate Limiting
```javascript
const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },    // 5/15min
  register: { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10/hora
  purchase: { windowMs: 60 * 1000, maxRequests: 10 },      // 10/min
  adminAction: { windowMs: 60 * 1000, maxRequests: 30 },   // 30/min
  general: { windowMs: 60 * 1000, maxRequests: 100 },      // 100/min
};
```

#### Logs de Auditoria
```javascript
export function auditLog(logEntry) {
  const entry = { timestamp: new Date().toISOString(), ...logEntry };
  auditLogs.push(entry);

  const criticalActions = [
    'ADMIN_ACCESS_DENIED',
    'RATE_LIMIT_EXCEEDED',
    'CARD_INTEGRITY_FAILED',
    'WINNER_VERIFICATION_FAILED',
    'SUSPICIOUS_ACTIVITY',
  ];

  if (criticalActions.includes(logEntry.action)) {
    console.warn('[SECURITY AUDIT]', JSON.stringify(entry));
  }
}
```

#### Sanitizacion de Requests
```javascript
function sanitizeObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove null bytes and control characters
      obj[key] = obj[key].replace(/\x00/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      // Prevent NoSQL injection
      if (obj[key].includes('$') && obj[key].startsWith('$')) {
        obj[key] = obj[key].replace(/\$/g, '');
      }
    }
  }
}
```

### 5. Validacion Estricta de Cantidades Fibonacci
**Archivo**: `bingo-backend/src/routes/cards.js`

```javascript
const VALID_QUANTITIES = [1, 2, 3, 5, 8, 13, 21, 34];

router.post('/purchase', rateLimit('purchase'), verifyToken, async (req, res) => {
  // SECURITY: Block cardIds - manual selection is NOT allowed
  if (req.body.cardIds) {
    auditLog({
      action: 'SUSPICIOUS_ACTIVITY',
      reason: 'Attempted manual cardIds selection',
      userId,
    });
    return res.status(400).json({
      error: 'Manual card selection is not allowed.',
    });
  }

  // SECURITY: Validate Fibonacci quantity
  if (!VALID_QUANTITIES.includes(quantity)) {
    auditLog({ action: 'INVALID_QUANTITY_ATTEMPT', userId, quantity });
    return res.status(400).json({
      error: `Invalid quantity. Must be: ${VALID_QUANTITIES.join(', ')}`,
    });
  }
});
```

### 6. Security Headers
**Archivo**: `bingo-backend/src/index.js`

```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(securityHeaders); // X-Frame-Options, X-XSS-Protection, etc.
app.use(sanitizeRequest);
app.use(rateLimit('general'));
```

### 7. Verificacion de Ganadores con Integridad
**Archivo**: `bingo-backend/src/services/socket.js`

```javascript
socket.on('admin:verify-winner', async ({ cardId }) => {
  // Verify card integrity if hash exists
  if (purchasedCard.card.hash) {
    const isValid = bingoCard.verifyCardIntegrity(purchasedCard.card);
    if (!isValid) {
      auditLog({
        action: 'CARD_INTEGRITY_FAILED',
        cardId,
        owner: purchasedCard.owner,
      });
      socket.emit('error', { message: 'Card integrity verification failed' });
      return;
    }
  }

  // Audit log for winner verification
  auditLog({
    action: 'WINNER_VERIFIED',
    cardId,
    owner: purchasedCard.owner,
    pattern: result.pattern,
  });
});
```

### Resumen de Protecciones Implementadas

| Vulnerabilidad | Solucion | Archivo |
|----------------|----------|---------|
| Admin impersonation via socket | isAdmin=false explicito + wallet whitelist | socket.js |
| Weak randomness (Math.random) | crypto.randomBytes con rejection sampling | bingoCard.js |
| Card tampering | HMAC-SHA256 integrity hash | bingoCard.js |
| Brute force login | Rate limiting por tipo de endpoint | security.js |
| NoSQL injection | Sanitizacion de $ en inputs | security.js |
| Manual card selection | Bloqueado cardIds, solo quantity | cards.js |
| Invalid quantities | Solo Fibonacci (1,2,3,5,8,13,21,34) | cards.js |
| Missing audit trail | Logs de auditoria para acciones criticas | security.js |
| XSS/Clickjacking | Helmet + security headers | index.js |

---

## Whitelist de Administradores (Actualizada)

### Wallets Admin Actuales
```
0x13ef1f97a3De80CEE38ca77267795a635798C101
0x0F36B46E5bD24a81789a59F215f6219749AC985a
```

---

## Estado de la Base de Datos (25 Dic 2024)

### Estadisticas Actuales
| Metrica | Valor |
|---------|-------|
| **Usuarios registrados** | 1 |
| **Cartones comprados** | 5 |
| **Cartones disponibles** | 45 |
| **Juegos jugados** | 13 |

### Usuario Actual
| Campo | Valor |
|-------|-------|
| Username | f3l1p3 |
| Wallet | 0x0f36b46e5bd24a81789a59f215f6219749ac985a |
| Admin | Si |
| Creado | 24 Dic 2024 |

---

## Bingo Live - Deteccion Automatica de Ganadores

### Flujo de Deteccion
1. Admin llama un numero via `admin:call-number`
2. Backend verifica todos los cartones comprados
3. Si un carton completa BINGO, emite `potential-winner` a todos
4. Frontend muestra alerta con animacion "BINGO!"
5. Admin ve panel con posibles ganadores
6. Admin verifica con `admin:verify-winner`
7. Backend valida integridad del carton
8. Si es valido, emite `winner-announced` y termina el juego

### Eventos Socket Relacionados
```javascript
// Emitido cuando se detecta posible ganador
socket.on('potential-winner', {
  cardId: string,
  owner: string,
  username: string,
  wallet: string,
  pattern: 'row' | 'column' | 'diagonal',
  detectedAt: string,
});

// Emitido cuando admin verifica ganador
socket.on('winner-announced', {
  winner: {
    cardId: string,
    owner: string,
    ownerUsername: string,
    ownerWallet: string,
    pattern: string,
    verifiedAt: string,
  }
});
```

### Estado del Juego (gameState)
```javascript
{
  status: 'waiting' | 'playing' | 'paused' | 'ended',
  calledNumbers: number[],
  currentNumber: number | null,
  winner: object | null,
  potentialWinners: array,  // NUEVO: cartones que completaron BINGO
}
```

---

## Arquitectura AWS (Planificada)

### Diagrama de Arquitectura
```
                                    ┌─────────────────┐
                                    │   CloudFront    │
                                    │    (CDN)        │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌────────────────┐      ┌─────────────────┐      ┌─────────────────┐
           │   S3 Bucket    │      │   API Gateway   │      │ API Gateway     │
           │  (Frontend)    │      │    (REST)       │      │  (WebSocket)    │
           └────────────────┘      └────────┬────────┘      └────────┬────────┘
                                            │                        │
                                            ▼                        ▼
                                   ┌─────────────────┐      ┌─────────────────┐
                                   │  Lambda (API)   │      │ Lambda (WS)     │
                                   │                 │◄────►│ Connection Mgr  │
                                   └────────┬────────┘      └────────┬────────┘
                                            │                        │
                    ┌───────────────────────┴────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────────────────────────────┐
           │                      DynamoDB                            │
           │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
           │  │  Users  │  │  Cards  │  │  Games  │  │  Winners    │ │
           │  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘ │
           │       │            │            │              │        │
           │       └────────────┴────────────┴──────────────┘        │
           │                          │                               │
           │                   DynamoDB Streams                       │
           └──────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │ Lambda (Stream  │
                             │   Processor)    │
                             └─────────────────┘
```

### Servicios AWS a Utilizar

| Servicio | Uso | Reemplaza |
|----------|-----|-----------|
| **S3** | Hosting frontend (React build) | Servidor local Vite |
| **CloudFront** | CDN para frontend | N/A |
| **API Gateway (REST)** | Endpoints HTTP | Express routes |
| **API Gateway (WebSocket)** | Conexiones realtime | Socket.io |
| **Lambda** | Logica de negocio | Node.js server |
| **DynamoDB** | Persistencia de datos | MongoDB Atlas |
| **DynamoDB Streams** | Eventos de cambios | N/A |
| **Secrets Manager** | Variables de entorno | .env file |
| **CloudWatch** | Logs y monitoreo | console.log |

### Tablas DynamoDB

#### Users Table
```javascript
{
  TableName: 'ultrabingo-users',
  KeySchema: [
    { AttributeName: 'odId', KeyType: 'HASH' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'wallet-index',
      KeySchema: [{ AttributeName: 'wallet', KeyType: 'HASH' }]
    }
  ],
  Attributes: {
    odId: 'S',           // "user_0x..."
    username: 'S',
    wallet: 'S',
    isAdmin: 'BOOL',
    stats: 'M',          // Map con gamesPlayed, cardsPurchased, etc.
    createdAt: 'S',
    lastLoginAt: 'S'
  }
}
```

#### Cards Table
```javascript
{
  TableName: 'ultrabingo-cards',
  KeySchema: [
    { AttributeName: 'cardId', KeyType: 'HASH' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'owner-index',
      KeySchema: [{ AttributeName: 'owner', KeyType: 'HASH' }]
    },
    {
      IndexName: 'status-index',
      KeySchema: [{ AttributeName: 'status', KeyType: 'HASH' }]
    }
  ],
  Attributes: {
    cardId: 'S',
    numbers: 'M',        // { B: [1,2,3,4,5], I: [...], ... }
    status: 'S',         // 'available' | 'purchased' | 'expired'
    owner: 'S',
    ownerUsername: 'S',
    ownerWallet: 'S',
    hash: 'S',           // Integrity hash
    purchasedAt: 'S',
    createdAt: 'S'
  },
  StreamSpecification: {
    StreamEnabled: true,
    StreamViewType: 'NEW_AND_OLD_IMAGES'
  }
}
```

#### Games Table
```javascript
{
  TableName: 'ultrabingo-games',
  KeySchema: [
    { AttributeName: 'gameId', KeyType: 'HASH' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'status-index',
      KeySchema: [{ AttributeName: 'status', KeyType: 'HASH' }]
    }
  ],
  Attributes: {
    gameId: 'S',
    status: 'S',
    gameMode: 'S',
    calledNumbers: 'L',   // List of numbers
    currentNumber: 'N',
    winner: 'M',          // Winner object if exists
    startedAt: 'S',
    endedAt: 'S'
  },
  StreamSpecification: {
    StreamEnabled: true,
    StreamViewType: 'NEW_AND_OLD_IMAGES'
  }
}
```

#### Winners Table
```javascript
{
  TableName: 'ultrabingo-winners',
  KeySchema: [
    { AttributeName: 'winnerId', KeyType: 'HASH' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'wallet-index',
      KeySchema: [{ AttributeName: 'wallet', KeyType: 'HASH' }]
    },
    {
      IndexName: 'wonAt-index',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },  // pk = 'WINNER'
        { AttributeName: 'wonAt', KeyType: 'RANGE' }
      ]
    }
  ],
  Attributes: {
    winnerId: 'S',
    pk: 'S',             // Always 'WINNER' for GSI queries
    gameId: 'S',
    odId: 'S',
    odUsername: 'S',
    wallet: 'S',
    cardId: 'S',
    gameMode: 'S',
    patternName: 'S',
    prizeAmount: 'S',
    totalCalledNumbers: 'N',
    wonAt: 'S'
  }
}
```

#### WebSocket Connections Table
```javascript
{
  TableName: 'ultrabingo-connections',
  KeySchema: [
    { AttributeName: 'connectionId', KeyType: 'HASH' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'gameId-index',
      KeySchema: [{ AttributeName: 'gameId', KeyType: 'HASH' }]
    }
  ],
  Attributes: {
    connectionId: 'S',
    gameId: 'S',
    odId: 'S',
    isAdmin: 'BOOL',
    connectedAt: 'S',
    ttl: 'N'             // TTL para limpieza automatica
  }
}
```

### API Gateway WebSocket - Rutas

| Route Key | Lambda Handler | Descripcion |
|-----------|---------------|-------------|
| `$connect` | `wsConnect` | Autenticacion y registro de conexion |
| `$disconnect` | `wsDisconnect` | Limpieza de conexion |
| `$default` | `wsDefault` | Manejo de mensajes no reconocidos |
| `joinGame` | `wsJoinGame` | Usuario se une a partida |
| `leaveGame` | `wsLeaveGame` | Usuario abandona partida |
| `admin:call-number` | `wsAdminCallNumber` | Admin llama numero |
| `admin:start-game` | `wsAdminStartGame` | Admin inicia juego |
| `admin:pause-game` | `wsAdminPauseGame` | Admin pausa juego |
| `admin:resume-game` | `wsAdminResumeGame` | Admin reanuda juego |
| `admin:end-game` | `wsAdminEndGame` | Admin termina juego |
| `admin:verify-winner` | `wsAdminVerifyWinner` | Admin verifica ganador |
| `admin:reject-winner` | `wsAdminRejectWinner` | Admin rechaza ganador |

### Broadcast de Mensajes WebSocket

```javascript
// Funcion para enviar mensaje a todos los clientes conectados
async function broadcastToGame(gameId, message) {
  const connections = await dynamodb.query({
    TableName: 'ultrabingo-connections',
    IndexName: 'gameId-index',
    KeyConditionExpression: 'gameId = :gid',
    ExpressionAttributeValues: { ':gid': gameId }
  });

  const apiGateway = new ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_ENDPOINT
  });

  const promises = connections.Items.map(conn =>
    apiGateway.postToConnection({
      ConnectionId: conn.connectionId,
      Data: JSON.stringify(message)
    }).promise().catch(e => {
      // Conexion stale, eliminar
      if (e.statusCode === 410) {
        return dynamodb.delete({
          TableName: 'ultrabingo-connections',
          Key: { connectionId: conn.connectionId }
        });
      }
    })
  );

  await Promise.all(promises);
}
```

### DynamoDB Streams - Casos de Uso

1. **Game Status Changes**: Cuando cambia el status del juego, notificar a todos los clientes
2. **New Called Number**: Cuando se agrega un numero, broadcast a todos
3. **Winner Announced**: Cuando se registra ganador, notificar y actualizar stats
4. **Card Purchased**: Actualizar estadisticas del usuario

```javascript
// Lambda Stream Processor
export async function handler(event) {
  for (const record of event.Records) {
    if (record.eventName === 'MODIFY' && record.dynamodb.NewImage.status) {
      const tableName = getTableNameFromArn(record.eventSourceARN);

      if (tableName === 'ultrabingo-games') {
        const newGame = unmarshall(record.dynamodb.NewImage);
        const oldGame = unmarshall(record.dynamodb.OldImage);

        // Detectar cambios relevantes
        if (newGame.currentNumber !== oldGame.currentNumber) {
          await broadcastToGame(newGame.gameId, {
            event: 'number-called',
            data: { number: newGame.currentNumber, calledNumbers: newGame.calledNumbers }
          });
        }

        if (newGame.status !== oldGame.status) {
          await broadcastToGame(newGame.gameId, {
            event: 'game-status-changed',
            data: { status: newGame.status, gameState: newGame }
          });
        }
      }
    }
  }
}
```

### Terraform - Estructura de Archivos

```
terraform/
├── main.tf                 # Provider y configuracion general
├── variables.tf            # Variables de entrada
├── outputs.tf              # Outputs (URLs, ARNs)
├── s3.tf                   # Bucket frontend + CloudFront
├── dynamodb.tf             # Tablas DynamoDB
├── lambda.tf               # Funciones Lambda
├── api-gateway-rest.tf     # API Gateway REST
├── api-gateway-ws.tf       # API Gateway WebSocket
├── iam.tf                  # Roles y policies
├── secrets.tf              # Secrets Manager
└── cloudwatch.tf           # Logs y alarmas
```

### Variables de Entorno Lambda

```hcl
# terraform/variables.tf
variable "environment" {
  default = "production"
}

variable "x402_facilitator_url" {
  default = "https://facilitator.ultravioletadao.xyz"
}

variable "x402_network" {
  default = "avalanche"
}

variable "x402_receiver_address" {
  default = "0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8"
}

variable "card_price" {
  default = "0.001"
}

variable "admin_wallets" {
  type = list(string)
  default = [
    "0x13ef1f97a3de80cee38ca77267795a635798c101",
    "0x0f36b46e5bd24a81789a59f215f6219749ac985a"
  ]
}
```

### Cambios Necesarios en el Codigo

#### Frontend (config/index.js)
```javascript
// Antes (desarrollo)
export const config = {
  apiUrl: 'http://localhost:5000',
  wsUrl: 'http://localhost:5000',
  // ...
};

// Despues (produccion AWS)
export const config = {
  apiUrl: process.env.VITE_API_URL || 'https://api.ultrabingo.ultravioletadao.xyz',
  wsUrl: process.env.VITE_WS_URL || 'wss://ws.ultrabingo.ultravioletadao.xyz',
  // ...
};
```

#### SocketContext.jsx - Adaptacion para API Gateway WebSocket
```javascript
// API Gateway WebSocket no usa Socket.io
// Necesita adaptacion a WebSocket nativo

const connectToGame = useCallback(() => {
  const ws = new WebSocket(config.wsUrl);

  ws.onopen = () => {
    // Enviar autenticacion
    ws.send(JSON.stringify({
      action: 'authenticate',
      token: localStorage.getItem('token')
    }));
  };

  ws.onmessage = (event) => {
    const { event: eventName, data } = JSON.parse(event.data);
    // Manejar eventos...
  };

  // Para enviar mensajes (antes: socket.emit)
  const emit = (action, data) => {
    ws.send(JSON.stringify({ action, ...data }));
  };
}, []);
```

### Consideraciones de Migracion

1. **Socket.io -> API Gateway WebSocket**:
   - Eliminar dependencia de socket.io
   - Usar WebSocket nativo en frontend
   - Adaptar manejo de eventos

2. **MongoDB -> DynamoDB**:
   - Mongoose queries -> DynamoDB DocumentClient
   - Cambiar indices y queries
   - Adaptar modelos a estructura de items

3. **Express -> Lambda**:
   - Separar handlers por endpoint
   - Adaptar middleware a Lambda layers
   - Manejar cold starts

4. **Variables de entorno**:
   - .env -> Secrets Manager / Lambda env vars
   - Terraform para gestion de secrets

### Costos Estimados (AWS Free Tier + Low Traffic)

| Servicio | Free Tier | Estimado Mensual |
|----------|-----------|------------------|
| S3 | 5GB | $0.023/GB |
| CloudFront | 1TB | $0.085/GB |
| Lambda | 1M requests | $0.20/1M requests |
| API Gateway | 1M requests | $3.50/1M requests |
| DynamoDB | 25GB + 25 WCU/RCU | $0 (free tier) |

**Total estimado**: ~$5-15/mes para trafico bajo

---

## Proximos Pasos de Desarrollo

1. [ ] Completar sistema de premios (pool y distribucion)
2. [ ] Testing completo (unit + integration)
3. [ ] Crear estructura Terraform
4. [ ] Adaptar SocketContext para WebSocket nativo
5. [ ] Crear Lambdas y adaptar rutas Express
6. [ ] Migrar modelos de Mongoose a DynamoDB
7. [ ] Configurar CI/CD (GitHub Actions)
8. [ ] Deploy a AWS
