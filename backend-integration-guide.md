# 后端集成指南

## 技术栈
- JDK 17
- Web3j 4.12.2
- Spring Boot 3.2.x/3.3.x

## 合约信息

### 已部署合约地址
- **RMBToken**: `0x47c05BCCA7d57c87083EB4e586007530eE4539e9`
- **EscrowContract**: `0x773330693cb7d5D233348E25809770A32483A940`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3` (Uniswap官方地址)

## 1. Maven 依赖配置

```xml
<dependencies>
    <!-- Spring Boot Starter -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    
    <!-- Web3j -->
    <dependency>
        <groupId>org.web3j</groupId>
        <artifactId>core</artifactId>
        <version>4.12.2</version>
    </dependency>
    
    <!-- Web3j Spring Boot Starter -->
    <dependency>
        <groupId>org.web3j</groupId>
        <artifactId>web3j-spring-boot-starter</artifactId>
        <version>4.12.2</version>
    </dependency>
    
    <!-- Jackson for JSON processing -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
</dependencies>
```

## 2. Spring Boot 配置

### application.yml
```yaml
web3j:
  client-address: "http://localhost:8545"  # 本地Hardhat节点
  admin-client: true
  network-id: 1337
  http-timeout: 30000
  
app:
  blockchain:
    contracts:
      rmb-token: "0x47c05BCCA7d57c87083EB4e586007530eE4539e9"
      escrow-contract: "0x773330693cb7d5D233348E25809770A32483A940"
      permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
    private-key: "${PRIVATE_KEY:}"  # 操作员私钥
    gas-price: 20000000000  # 20 Gwei
    gas-limit: 300000
```

## 3. 核心合约接口

### RMBToken 主要方法

```java
// 查询方法
public BigInteger balanceOf(String owner);
public BigInteger totalSupply();
public BigInteger allowance(String owner, String spender);
public String name();
public String symbol();
public BigInteger decimals();
public String currency();
public Boolean paused();
public Boolean minters(String account);

// 交易方法
public TransactionReceipt transfer(String to, BigInteger value);
public TransactionReceipt approve(String spender, BigInteger value);
public TransactionReceipt transferFrom(String from, String to, BigInteger value);
public TransactionReceipt mint(String to, BigInteger amount);  // 仅铸造者
public TransactionReceipt burn(BigInteger amount);

// Permit方法
public TransactionReceipt permit(
    String owner, String spender, BigInteger value, 
    BigInteger deadline, BigInteger v, byte[] r, byte[] s
);
public BigInteger nonces(String owner);
public byte[] DOMAIN_SEPARATOR();
```

### EscrowContract 主要方法

```java
// 查询方法
public BigInteger getUserNonce(String user);
public EscrowRecord getEscrowRecord(byte[] intentHash);
public Boolean isOperator(String operator);
public Boolean isTokenSupported(String token);
public Boolean operators(String operator);
public String operatorNames(String operator);
public Boolean supportedTokens(String token);

// 管理方法（仅Owner）
public TransactionReceipt registerOperator(String operator, String name);
public TransactionReceipt removeOperator(String operator);
public TransactionReceipt setTokenSupport(String token, Boolean supported);
public TransactionReceipt pause();
public TransactionReceipt unpause();

// 核心支付方法
public TransactionReceipt authorizePaymentWithPermit2(
    PaymentIntent intent,
    byte[] intentSignature,
    PermitTransferFrom permit,
    byte[] permitSignature
);
public TransactionReceipt capturePayment(byte[] intentHash);
public TransactionReceipt refundPayment(byte[] intentHash, String reason);
public TransactionReceipt autoRefundExpired(byte[] intentHash);

// 工具方法
public byte[] generateIntentHash(PaymentIntent intent);
```

## 4. 数据结构定义

### PaymentIntent
```java
public class PaymentIntent {
    private String payer;        // 付款方地址
    private String payee;        // 收款方地址
    private String token;        // 代币合约地址
    private BigInteger amount;   // 支付金额
    private BigInteger expiryTime; // 过期时间戳
    private BigInteger nonce;    // 用户nonce
    
    // getters and setters
}
```

### EscrowRecord
```java
public class EscrowRecord {
    private String payer;
    private String payee;
    private String token;
    private BigInteger amount;
    private BigInteger createdAt;
    private BigInteger expiryTime;
    private BigInteger status;   // 0=NONE, 1=AUTHORIZED, 2=CAPTURED, 3=REFUNDED, 4=EXPIRED
    private String operator;
    
    // getters and setters
}
```

### PermitTransferFrom (Permit2)
```java
public class PermitTransferFrom {
    private TokenPermissions permitted;
    private BigInteger nonce;
    private BigInteger deadline;
    
    public static class TokenPermissions {
        private String token;
        private BigInteger amount;
        // getters and setters
    }
}
```

## 5. 后端API接口设计

### 支付相关接口

```java
@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    
    // 创建支付意图
    @PostMapping("/intent")
    public ResponseEntity<PaymentIntentResponse> createPaymentIntent(
        @RequestBody CreatePaymentIntentRequest request
    );
    
    // 授权支付
    @PostMapping("/authorize")
    public ResponseEntity<AuthorizePaymentResponse> authorizePayment(
        @RequestBody AuthorizePaymentRequest request
    );
    
    // 捕获支付
    @PostMapping("/capture/{intentHash}")
    public ResponseEntity<CapturePaymentResponse> capturePayment(
        @PathVariable String intentHash
    );
    
    // 退款
    @PostMapping("/refund/{intentHash}")
    public ResponseEntity<RefundPaymentResponse> refundPayment(
        @PathVariable String intentHash,
        @RequestBody RefundPaymentRequest request
    );
    
    // 查询支付状态
    @GetMapping("/status/{intentHash}")
    public ResponseEntity<PaymentStatusResponse> getPaymentStatus(
        @PathVariable String intentHash
    );
    
    // 查询用户nonce
    @GetMapping("/nonce/{userAddress}")
    public ResponseEntity<NonceResponse> getUserNonce(
        @PathVariable String userAddress
    );
}
```

### 代币相关接口

```java
@RestController
@RequestMapping("/api/tokens")
public class TokenController {
    
    // 查询余额
    @GetMapping("/balance/{address}")
    public ResponseEntity<BalanceResponse> getBalance(
        @PathVariable String address,
        @RequestParam(defaultValue = "RMB") String tokenSymbol
    );
    
    // 查询代币信息
    @GetMapping("/info/{tokenAddress}")
    public ResponseEntity<TokenInfoResponse> getTokenInfo(
        @PathVariable String tokenAddress
    );
    
    // 铸造代币（仅管理员）
    @PostMapping("/mint")
    public ResponseEntity<MintResponse> mintTokens(
        @RequestBody MintTokensRequest request
    );
    
    // 查询支持的代币列表
    @GetMapping("/supported")
    public ResponseEntity<List<SupportedTokenResponse>> getSupportedTokens();
}
```

## 6. 请求/响应数据结构

### 创建支付意图请求
```java
public class CreatePaymentIntentRequest {
    private String payerAddress;
    private String payeeAddress;
    private String tokenAddress;
    private String amount;  // 字符串格式，避免精度问题
    private Long expiryTimeSeconds;
}
```

### 授权支付请求
```java
public class AuthorizePaymentRequest {
    private PaymentIntent intent;
    private String intentSignature;  // hex格式
    private PermitTransferFrom permit;
    private String permitSignature;  // hex格式
}
```

### 支付状态响应
```java
public class PaymentStatusResponse {
    private String intentHash;
    private String status;  // "NONE", "AUTHORIZED", "CAPTURED", "REFUNDED", "EXPIRED"
    private EscrowRecord escrowRecord;
    private String transactionHash;
    private Long blockNumber;
}
```

## 7. 事件监听

### 关键事件

```java
@Component
public class BlockchainEventListener {
    
    // 监听支付授权事件
    @EventListener
    public void handlePaymentAuthorized(PaymentAuthorizedEventResponse event) {
        // 处理支付授权事件
        String intentHash = Numeric.toHexString(event.intentHash);
        // 更新数据库状态
    }
    
    // 监听支付捕获事件
    @EventListener
    public void handlePaymentCaptured(PaymentCapturedEventResponse event) {
        // 处理支付捕获事件
    }
    
    // 监听支付退款事件
    @EventListener
    public void handlePaymentRefunded(PaymentRefundedEventResponse event) {
        // 处理退款事件
    }
}
```

## 8. 工具类示例

### 签名工具
```java
@Component
public class SignatureUtils {
    
    // 生成EIP-712签名
    public String signPaymentIntent(PaymentIntent intent, String privateKey) {
        // 实现EIP-712签名逻辑
    }
    
    // 验证签名
    public boolean verifySignature(String message, String signature, String address) {
        // 实现签名验证逻辑
    }
    
    // 生成Permit2签名
    public String signPermit2(PermitTransferFrom permit, String privateKey) {
        // 实现Permit2签名逻辑
    }
}
```

### 金额转换工具
```java
@Component
public class AmountUtils {
    
    private static final int RMB_DECIMALS = 6;
    
    // 人民币转Wei（考虑6位小数）
    public BigInteger rmbToWei(String rmbAmount) {
        BigDecimal rmb = new BigDecimal(rmbAmount);
        BigDecimal wei = rmb.multiply(BigDecimal.TEN.pow(RMB_DECIMALS));
        return wei.toBigInteger();
    }
    
    // Wei转人民币
    public String weiToRmb(BigInteger wei) {
        BigDecimal rmbDecimal = new BigDecimal(wei)
            .divide(BigDecimal.TEN.pow(RMB_DECIMALS));
        return rmbDecimal.toPlainString();
    }
}
```

## 9. 错误处理

### 自定义异常
```java
public class BlockchainException extends RuntimeException {
    private final String errorCode;
    private final String contractAddress;
    
    public BlockchainException(String message, String errorCode, String contractAddress) {
        super(message);
        this.errorCode = errorCode;
        this.contractAddress = contractAddress;
    }
}

@ControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(BlockchainException.class)
    public ResponseEntity<ErrorResponse> handleBlockchainException(BlockchainException e) {
        ErrorResponse error = new ErrorResponse(
            e.getErrorCode(),
            e.getMessage(),
            e.getContractAddress()
        );
        return ResponseEntity.badRequest().body(error);
    }
}
```

## 10. 前端集成接口

### JavaScript/TypeScript 接口

```typescript
// 支付意图接口
interface PaymentIntent {
  payer: string;
  payee: string;
  token: string;
  amount: string;
  expiryTime: number;
  nonce: number;
}

// API调用接口
interface PaymentAPI {
  // 创建支付意图
  createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntentResponse>;
  
  // 获取用户nonce
  getUserNonce(userAddress: string): Promise<number>;
  
  // 授权支付
  authorizePayment(request: AuthorizePaymentRequest): Promise<AuthorizePaymentResponse>;
  
  // 查询支付状态
  getPaymentStatus(intentHash: string): Promise<PaymentStatusResponse>;
  
  // 查询余额
  getBalance(address: string, tokenSymbol?: string): Promise<BalanceResponse>;
}

// 前端签名接口
interface SignatureService {
  // 签名支付意图
  signPaymentIntent(intent: PaymentIntent, signer: any): Promise<string>;
  
  // 签名Permit2
  signPermit2(permit: PermitTransferFrom, signer: any): Promise<string>;
}
```

### 前端调用示例
```typescript
// 创建支付流程
async function createPayment(paymentData: PaymentData) {
  try {
    // 1. 创建支付意图
    const intentResponse = await paymentAPI.createPaymentIntent({
      payerAddress: paymentData.payer,
      payeeAddress: paymentData.payee,
      tokenAddress: RMB_TOKEN_ADDRESS,
      amount: paymentData.amount,
      expiryTimeSeconds: Math.floor(Date.now() / 1000) + 3600 // 1小时后过期
    });
    
    // 2. 用户签名支付意图
    const intentSignature = await signatureService.signPaymentIntent(
      intentResponse.intent, 
      signer
    );
    
    // 3. 创建Permit2授权
    const permit = {
      permitted: {
        token: RMB_TOKEN_ADDRESS,
        amount: paymentData.amount
      },
      nonce: await getPermit2Nonce(paymentData.payer),
      deadline: Math.floor(Date.now() / 1000) + 3600
    };
    
    // 4. 用户签名Permit2
    const permitSignature = await signatureService.signPermit2(permit, signer);
    
    // 5. 提交授权支付
    const authResponse = await paymentAPI.authorizePayment({
      intent: intentResponse.intent,
      intentSignature,
      permit,
      permitSignature
    });
    
    return authResponse;
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
}
```

## 11. 部署和配置

### 环境变量
```bash
# 区块链配置
ETH_NODE_URL=http://localhost:8545
CHAIN_ID=1337

# 合约地址
RMB_TOKEN_ADDRESS=0x47c05BCCA7d57c87083EB4e586007530eE4539e9
ESCROW_CONTRACT_ADDRESS=0x773330693cb7d5D233348E25809770A32483A940
PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3

# 操作员私钥（生产环境使用密钥管理服务）
OPERATOR_PRIVATE_KEY=

# 数据库配置
DATABASE_URL=
DATABASE_USERNAME=
DATABASE_PASSWORD=
```

### Docker配置
```dockerfile
FROM openjdk:17-jdk-slim

WORKDIR /app
COPY target/payment-backend-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

这个集成指南提供了完整的后端和前端调用合约所需的接口信息，包括合约方法、数据结构、API设计和实现示例。