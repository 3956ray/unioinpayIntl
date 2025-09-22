// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title RMBToken - 人民币代币合约 MVP版本
 * @dev 基于USDC架构的人民币稳定币实现
 * @dev 第一阶段实现：基础ERC-20功能 + EIP-2612 Permit功能
 * 
 * 功能特性：
 * - 标准ERC-20代币功能
 * - EIP-2612 Permit支持（无Gas签名授权）
 * - 基础权限管理（Owner + Minter）
 * - 紧急暂停功能
 * - 6位小数精度（符合人民币分单位）
 */
contract RMBToken is ERC20, ERC20Permit, Ownable, Pausable, ReentrancyGuard {
    
    // ============ 状态变量 ============
    
    /// @dev 代币货币标识
    string public currency;
    
    /// @dev 铸造者权限映射
    mapping(address => bool) public minters;
    
    // ============ 事件定义 ============
    
    /// @dev 铸造事件
    event Mint(address indexed minter, address indexed to, uint256 amount);
    
    /// @dev 销毁事件  
    event Burn(address indexed burner, uint256 amount);
    
    /// @dev 添加铸造者事件
    event MinterAdded(address indexed minter);
    
    /// @dev 移除铸造者事件
    event MinterRemoved(address indexed minter);
    
    // ============ 修饰符 ============
    
    /// @dev 仅铸造者可调用（Owner自动拥有铸造权限）
    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "RMBToken: caller is not a minter");
        _;
    }
    
    /// @dev 地址非零检查
    modifier notZeroAddress(address account) {
        require(account != address(0), "RMBToken: zero address");
        _;
    }
    
    // ============ 构造函数 ============
    
    /**
     * @dev 构造函数
     * @param name 代币名称
     * @param symbol 代币符号
     * @param currency_ 货币标识
     * @param owner 合约所有者
     */
    constructor(
        string memory name,
        string memory symbol, 
        string memory currency_,
        address owner
    ) 
        ERC20(name, symbol) 
        ERC20Permit(name)
        notZeroAddress(owner)
    {
        currency = currency_;
        _transferOwnership(owner);
    }
    
    // ============ ERC-20 核心功能 ============
    
    /**
     * @dev 返回代币小数位数（6位，符合人民币分单位）
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    /**
     * @dev 转账函数重写，添加暂停检查和重入防护
     */
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        nonReentrant
        notZeroAddress(to)
        returns (bool) 
    {
        require(amount > 0, "RMBToken: transfer amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "RMBToken: transfer amount exceeds balance");
        return super.transfer(to, amount);
    }
    
    /**
     * @dev 授权转账函数重写，添加暂停检查和重入防护
     */
    function transferFrom(address from, address to, uint256 amount)
        public
        override
        whenNotPaused
        nonReentrant
        notZeroAddress(to)
        notZeroAddress(from)
        returns (bool)
    {
        require(amount > 0, "RMBToken: transfer amount must be greater than 0");
        require(balanceOf(from) >= amount, "RMBToken: transfer amount exceeds balance");
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev 授权函数重写，添加暂停检查和重入防护
     */
    function approve(address spender, uint256 amount)
        public
        override
        whenNotPaused
        nonReentrant
        notZeroAddress(spender)
        returns (bool)
    {
        return super.approve(spender, amount);
    }
    
    // ============ 铸造和销毁功能 ============
    
    /**
     * @dev 铸造代币
     * @param to 接收地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) 
        external 
        onlyMinter 
        whenNotPaused
        nonReentrant
        notZeroAddress(to)
    {
        require(amount > 0, "RMBToken: mint amount must be greater than 0");
        require(amount <= 1000000 * 10**decimals(), "RMBToken: mint amount exceeds maximum limit");
        
        _mint(to, amount);
        emit Mint(msg.sender, to, amount);
    }
    
    /**
     * @dev 销毁代币
     * @param amount 销毁数量
     */
    function burn(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "RMBToken: burn amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "RMBToken: burn amount exceeds balance");
        
        _burn(msg.sender, amount);
        emit Burn(msg.sender, amount);
    }
    
    // ============ 权限管理功能 ============
    
    /**
     * @dev 添加铸造者
     * @param minter 铸造者地址
     */
    function addMinter(address minter) 
        external 
        onlyOwner 
        nonReentrant
        notZeroAddress(minter)
    {
        require(!minters[minter], "RMBToken: address is already a minter");
        require(minter != owner(), "RMBToken: owner is automatically a minter");
        
        minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev 移除铸造者
     * @param minter 铸造者地址
     */
    function removeMinter(address minter) 
        external 
        onlyOwner 
        nonReentrant
        notZeroAddress(minter)
    {
        require(minters[minter], "RMBToken: address is not a minter");
        require(minter != owner(), "RMBToken: cannot remove owner from minters");
        
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev 检查是否为铸造者（Owner自动拥有铸造权限）
     * @param account 待检查地址
     * @return 是否为铸造者
     */
    function isMinter(address account) external view returns (bool) {
        return minters[account] || account == owner();
    }
    
    /**
     * @dev 获取所有铸造者数量
     * @return 铸造者数量
     */
    function getMinterCount() external view returns (uint256) {
        // 注意：这个函数只是示例，实际实现需要维护铸造者列表
        // 在MVP版本中，我们简化实现
        return 0; // 占位符，实际应该维护铸造者数组
    }
    
    /**
     * @dev 批量添加铸造者（仅Owner）
     * @param minters_ 铸造者地址数组
     */
    function addMinters(address[] calldata minters_) 
        external 
        onlyOwner 
        nonReentrant
    {
        require(minters_.length > 0, "RMBToken: empty minters array");
        require(minters_.length <= 50, "RMBToken: too many minters in batch");
        
        for (uint256 i = 0; i < minters_.length; i++) {
            address minter = minters_[i];
            require(minter != address(0), "RMBToken: zero address");
            require(!minters[minter], "RMBToken: address is already a minter");
            require(minter != owner(), "RMBToken: owner is automatically a minter");
            
            minters[minter] = true;
            emit MinterAdded(minter);
        }
    }
    
    // ============ 紧急控制功能 ============
    
    /**
     * @dev 暂停合约（仅Owner）
     */
    function pause() external onlyOwner nonReentrant {
        _pause();
        emit Paused(_msgSender());
    }
    
    /**
     * @dev 恢复合约（仅Owner）
     */
    function unpause() external onlyOwner nonReentrant {
        _unpause();
        emit Unpaused(_msgSender());
    }
    
    // ============ EIP-2612 Permit功能 ============
    // 注意：ERC20Permit已经实现了完整的permit功能，包括：
    // - permit() 函数
    // - DOMAIN_SEPARATOR() 函数  
    // - nonces() 函数
    // - EIP-712 类型化数据签名支持
    
    /**
     * @dev 获取当前域分离器（继承自ERC20Permit）
     * @return 域分离器哈希值
     */
    function getDomainSeparator() external view returns (bytes32) {
        return DOMAIN_SEPARATOR();
    }
    
    // ============ 查询功能 ============
    
    /**
     * @dev 获取合约版本信息
     * @return 版本字符串
     */
    function version() external pure returns (string memory) {
        return "1.0.0-MVP";
    }
    
    /**
     * @dev 获取货币标识
     * @return 货币标识字符串
     */
    function getCurrency() external view returns (string memory) {
        return currency;
    }
    
    /**
     * @dev 批量查询余额
     * @param accounts 地址数组
     * @return balances 余额数组
     */
    function balanceOfBatch(address[] calldata accounts) 
        external 
        view 
        returns (uint256[] memory balances) 
    {
        balances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            balances[i] = balanceOf(accounts[i]);
        }
    }
}