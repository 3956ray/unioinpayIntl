# 后端合约ABI配置指南

## 概述

后端调用智能合约需要以下关键配置：
1. **合约ABI** - 应用程序二进制接口，定义合约方法和事件
2. **合约地址** - 已部署合约的区块链地址
3. **Web3j配置** - Java区块链交互库配置
4. **私钥管理** - 用于签名交易的私钥

## 1. 合约地址配置

```yaml
# application.yml
app:
  blockchain:
    contracts:
      rmb-token: "0x47c05BCCA7d57c87083EB4e586007530eE4539e9"
      escrow-contract: "0x773330693cb7d5D233348E25809770A32483A940"
      permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
```

## 2. ABI文件位置

合约编译后的ABI文件位于：
- **RMBToken ABI**: `contracts/artifacts/contracts/RMBToken.sol/RMBToken.json`
- **EscrowContract ABI**: `contracts/artifacts/contracts/EscrowContract.sol/EscrowContract.json`

## 3. Web3j合约包装类生成

### 3.1 安装Web3j CLI工具

```bash
# 下载Web3j CLI
curl -L https://github.com/web3j/web3j/releases/download/v4.12.2/web3j-4.12.2.zip -o web3j.zip
unzip web3j.zip
```

### 3.2 生成Java合约包装类

```bash
# 生成RMBToken包装类
web3j generate solidity \
  -a contracts/artifacts/contracts/RMBToken.sol/RMBToken.json \
  -o src/main/java \
  -p com.yourcompany.contracts

# 生成EscrowContract包装类
web3j generate solidity \
  -a contracts/artifacts/contracts/EscrowContract.sol/EscrowContract.json \
  -o src/main/java \
  -p com.yourcompany.contracts
```

### 3.3 Maven插件方式生成（推荐）

在`pom.xml`中添加Web3j Maven插件：

```xml
<plugin>
    <groupId>org.web3j</groupId>
    <artifactId>web3j-maven-plugin</artifactId>
    <version>4.12.2</version>
    <configuration>
        <packageName>com.yourcompany.contracts</packageName>
        <sourceDestination>src/main/java</sourceDestination>
        <nativeJavaType>true</nativeJavaType>
        <outputFormat>java</outputFormat>
        <soliditySourceFiles>
            <directory>../contracts/artifacts/contracts</directory>
            <includes>
                <include>**/*.json</include>
            </includes>
            <excludes>
                <exclude>**/*.dbg.json</exclude>
            </excludes>
        </soliditySourceFiles>
    </configuration>
    <executions>
        <execution>
            <id>generate-sources</id>
            <phase>generate-sources</phase>
            <goals>
                <goal>generate-sources</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

## 4. Spring Boot配置类

### 4.1 Web3j配置

```java
@Configuration
@EnableConfigurationProperties(BlockchainProperties.class)
public class Web3jConfig {
    
    @Autowired
    private BlockchainProperties blockchainProperties;
    
    @Bean
    public Web3j web3j() {
        return Web3j.build(new HttpService(blockchainProperties.getNodeUrl()));
    }
    
    @Bean
    public Credentials credentials() {
        return Credentials.create(blockchainProperties.getPrivateKey());
    }
    
    @Bean
    public ContractGasProvider gasProvider() {
        return new StaticGasProvider(
            BigInteger.valueOf(blockchainProperties.getGasPrice()),
            BigInteger.valueOf(blockchainProperties.getGasLimit())
        );
    }
}
```

### 4.2 配置属性类

```java
@ConfigurationProperties(prefix = "app.blockchain")
@Data
public class BlockchainProperties {
    private String nodeUrl = "http://localhost:8545";
    private String privateKey;
    private long gasPrice = 20000000000L; // 20 Gwei
    private long gasLimit = 300000L;
    
    private Contracts contracts = new Contracts();
    
    @Data
    public static class Contracts {
        private String rmbToken;
        private String escrowContract;
        private String permit2;
    }
}
```

## 5. 合约服务类

### 5.1 RMBToken服务

```java
@Service
public class RMBTokenService {
    
    private final RMBToken rmbTokenContract;
    
    public RMBTokenService(Web3j web3j, Credentials credentials, 
                          ContractGasProvider gasProvider,
                          BlockchainProperties properties) {
        this.rmbTokenContract = RMBToken.load(
            properties.getContracts().getRmbToken(),
            web3j,
            credentials,
            gasProvider
        );
    }
    
    public BigInteger getBalance(String address) throws Exception {
        return rmbTokenContract.balanceOf(address).send();
    }
    
    public String getSymbol() throws Exception {
        return rmbTokenContract.symbol().send();
    }
    
    public BigInteger getDecimals() throws Exception {
        return rmbTokenContract.decimals().send();
    }
    
    public TransactionReceipt transfer(String to, BigInteger amount) throws Exception {
        return rmbTokenContract.transfer(to, amount).send();
    }
    
    public TransactionReceipt mint(String to, BigInteger amount) throws Exception {
        return rmbTokenContract.mint(to, amount).send();
    }
}
```

### 5.2 EscrowContract服务

```java
@Service
public class EscrowContractService {
    
    private final EscrowContract escrowContract;
    
    public EscrowContractService(Web3j web3j, Credentials credentials,
                               ContractGasProvider gasProvider,
                               BlockchainProperties properties) {
        this.escrowContract = EscrowContract.load(
            properties.getContracts().getEscrowContract(),
            web3j,
            credentials,
            gasProvider
        );
    }
    
    public BigInteger getUserNonce(String userAddress) throws Exception {
        return escrowContract.getUserNonce(userAddress).send();
    }
    
    public boolean isTokenSupported(String tokenAddress) throws Exception {
        return escrowContract.isTokenSupported(tokenAddress).send();
    }
    
    public boolean isOperator(String operatorAddress) throws Exception {
        return escrowContract.isOperator(operatorAddress).send();
    }
    
    public TransactionReceipt authorizePayment(
            PaymentIntent intent,
            byte[] intentSignature,
            IPermit2.PermitTransferFrom permit,
            byte[] permitSignature) throws Exception {
        return escrowContract.authorizePaymentWithPermit2(
            intent, intentSignature, permit, permitSignature
        ).send();
    }
    
    public TransactionReceipt capturePayment(byte[] intentHash) throws Exception {
        return escrowContract.capturePayment(intentHash).send();
    }
    
    public TransactionReceipt refundPayment(byte[] intentHash, String reason) throws Exception {
        return escrowContract.refundPayment(intentHash, reason).send();
    }
}
```

## 6. 事件监听配置

### 6.1 事件监听服务

```java
@Service
@Slf4j
public class BlockchainEventService {
    
    private final EscrowContract escrowContract;
    private final ApplicationEventPublisher eventPublisher;
    
    public BlockchainEventService(EscrowContract escrowContract,
                                ApplicationEventPublisher eventPublisher) {
        this.escrowContract = escrowContract;
        this.eventPublisher = eventPublisher;
    }
    
    @PostConstruct
    public void startEventListening() {
        // 监听支付授权事件
        escrowContract.paymentAuthorizedEventFlowable(
            DefaultBlockParameterName.LATEST,
            DefaultBlockParameterName.LATEST
        ).subscribe(event -> {
            log.info("Payment authorized: {}", event.intentHash);
            eventPublisher.publishEvent(new PaymentAuthorizedEvent(event));
        });
        
        // 监听支付捕获事件
        escrowContract.paymentCapturedEventFlowable(
            DefaultBlockParameterName.LATEST,
            DefaultBlockParameterName.LATEST
        ).subscribe(event -> {
            log.info("Payment captured: {}", event.intentHash);
            eventPublisher.publishEvent(new PaymentCapturedEvent(event));
        });
        
        // 监听支付退款事件
        escrowContract.paymentRefundedEventFlowable(
            DefaultBlockParameterName.LATEST,
            DefaultBlockParameterName.LATEST
        ).subscribe(event -> {
            log.info("Payment refunded: {}", event.intentHash);
            eventPublisher.publishEvent(new PaymentRefundedEvent(event));
        });
    }
}
```

## 7. 数据类型转换工具

### 7.1 类型转换工具类

```java
@Component
public class ContractTypeConverter {
    
    // 将Java PaymentIntent转换为合约PaymentIntent
    public EscrowContract.PaymentIntent toContractPaymentIntent(
            com.yourcompany.dto.PaymentIntent javaIntent) {
        return new EscrowContract.PaymentIntent(
            javaIntent.getPayer(),
            javaIntent.getPayee(),
            javaIntent.getToken(),
            javaIntent.getAmount(),
            javaIntent.getExpiryTime(),
            javaIntent.getIntentHash(),
            javaIntent.getNonce()
        );
    }
    
    // 将合约EscrowRecord转换为Java对象
    public com.yourcompany.dto.EscrowRecord fromContractEscrowRecord(
            EscrowContract.EscrowRecord contractRecord) {
        return com.yourcompany.dto.EscrowRecord.builder()
            .payer(contractRecord.payer)
            .payee(contractRecord.payee)
            .token(contractRecord.token)
            .amount(contractRecord.amount)
            .createdAt(contractRecord.createdAt)
            .expiryTime(contractRecord.expiryTime)
            .status(contractRecord.status.intValue())
            .operator(contractRecord.operator)
            .build();
    }
    
    // 字节数组与十六进制字符串转换
    public byte[] hexStringToBytes(String hexString) {
        if (hexString.startsWith("0x")) {
            hexString = hexString.substring(2);
        }
        return Numeric.hexStringToByteArray(hexString);
    }
    
    public String bytesToHexString(byte[] bytes) {
        return Numeric.toHexString(bytes);
    }
}
```

## 8. 错误处理和重试机制

### 8.1 区块链异常处理

```java
@Component
public class BlockchainErrorHandler {
    
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 1000;
    
    public <T> T executeWithRetry(Supplier<T> operation, String operationName) {
        Exception lastException = null;
        
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return operation.get();
            } catch (Exception e) {
                lastException = e;
                log.warn("Attempt {} failed for {}: {}", attempt, operationName, e.getMessage());
                
                if (attempt < MAX_RETRIES) {
                    try {
                        Thread.sleep(RETRY_DELAY_MS * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Operation interrupted", ie);
                    }
                }
            }
        }
        
        throw new BlockchainOperationException(
            "Operation failed after " + MAX_RETRIES + " attempts: " + operationName,
            lastException
        );
    }
}
```

## 9. 测试配置

### 9.1 集成测试配置

```java
@SpringBootTest
@TestPropertySource(properties = {
    "app.blockchain.node-url=http://localhost:8545",
    "app.blockchain.contracts.rmb-token=0x47c05BCCA7d57c87083EB4e586007530eE4539e9",
    "app.blockchain.contracts.escrow-contract=0x773330693cb7d5D233348E25809770A32483A940"
})
class BlockchainIntegrationTest {
    
    @Autowired
    private RMBTokenService rmbTokenService;
    
    @Autowired
    private EscrowContractService escrowContractService;
    
    @Test
    void testGetTokenBalance() throws Exception {
        String testAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        BigInteger balance = rmbTokenService.getBalance(testAddress);
        assertThat(balance).isNotNull();
    }
    
    @Test
    void testGetUserNonce() throws Exception {
        String testAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        BigInteger nonce = escrowContractService.getUserNonce(testAddress);
        assertThat(nonce).isNotNull();
    }
}
```

## 10. 部署检查清单

### 10.1 必需的配置项

- [ ] **合约地址配置**：确保所有合约地址正确配置
- [ ] **ABI文件**：确保ABI文件可访问且最新
- [ ] **私钥管理**：安全存储操作员私钥
- [ ] **网络配置**：正确配置区块链节点URL
- [ ] **Gas配置**：设置合适的Gas价格和限制
- [ ] **事件监听**：配置事件监听和处理
- [ ] **错误处理**：实现重试和异常处理机制
- [ ] **测试覆盖**：编写集成测试验证功能

### 10.2 安全注意事项

1. **私钥安全**：
   - 生产环境使用密钥管理服务（如AWS KMS、Azure Key Vault）
   - 永远不要在代码中硬编码私钥
   - 使用环境变量或配置文件管理敏感信息

2. **网络安全**：
   - 使用HTTPS连接区块链节点
   - 配置防火墙规则限制访问
   - 定期更新依赖库版本

3. **交易安全**：
   - 验证所有输入参数
   - 实现交易确认机制
   - 监控异常交易活动

## 总结

后端调用智能合约需要：
1. **ABI文件** - 从`artifacts`目录获取
2. **合约地址** - 已部署的合约地址
3. **Web3j配置** - Java区块链交互配置
4. **私钥管理** - 安全的私钥存储和使用
5. **事件监听** - 实时监听区块链事件
6. **错误处理** - 完善的异常处理和重试机制

按照本指南配置后，您的Spring Boot应用就可以完整地与智能合约进行交互了。