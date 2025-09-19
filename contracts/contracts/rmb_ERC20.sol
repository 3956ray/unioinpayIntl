// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title RMB Stablecoin (CRMB)
 * @dev 基于USDC模板的人民币稳定币实现
 * 功能包括:
 * - ERC20标准代币功能
 * - 铸造和销毁机制
 * - 暂停/恢复功能
 * - 所有者权限管理
 * - EIP-2612 Permit功能
 */
contract RMBStablecoin is ERC20, ERC20Burnable, ERC20Pausable, Ownable, ERC20Permit {
    
    // 铸造者角色映射
    mapping(address => bool) public minters;
    
    // 黑名单映射
    mapping(address => bool) public blacklisted;
    
    // 事件定义
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);
    event DestroyedBlackFunds(address indexed blackListedUser, uint256 balance);
    
    // 修饰符
    modifier onlyMinter() {
        require(minters[msg.sender], "RMB: caller is not a minter");
        _;
    }
    
    modifier notBlacklisted(address account) {
        require(!blacklisted[account], "RMB: account is blacklisted");
        _;
    }
    
    /**
     * @dev 构造函数
     * @param initialOwner 初始所有者地址
     */
    constructor(address initialOwner) 
        ERC20("Chinese RMB Stablecoin", "CRMB") 
        Ownable(initialOwner)
        ERC20Permit("Chinese RMB Stablecoin")
    {
        // 设置初始所有者为铸造者
        minters[initialOwner] = true;
        emit MinterAdded(initialOwner);
    }
    
    /**
     * @dev 返回代币小数位数 (6位，与USDC一致)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    /**
     * @dev 铸造代币
     * @param to 接收地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) 
        public 
        onlyMinter 
        notBlacklisted(to)
        whenNotPaused 
    {
        _mint(to, amount);
    }
    
    /**
     * @dev 批量铸造代币
     * @param recipients 接收地址数组
     * @param amounts 铸造数量数组
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyMinter
        whenNotPaused
    {
        require(recipients.length == amounts.length, "RMB: arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(!blacklisted[recipients[i]], "RMB: recipient is blacklisted");
            _mint(recipients[i], amounts[i]);
        }
    }
    
    /**
     * @dev 添加铸造者
     * @param minter 铸造者地址
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "RMB: minter cannot be zero address");
        require(!minters[minter], "RMB: minter already exists");
        
        minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev 移除铸造者
     * @param minter 铸造者地址
     */
    function removeMinter(address minter) external onlyOwner {
        require(minters[minter], "RMB: minter does not exist");
        
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 添加到黑名单
     * @param account 要加入黑名单的地址
     */
    function addToBlacklist(address account) external onlyOwner {
        require(account != address(0), "RMB: cannot blacklist zero address");
        require(!blacklisted[account], "RMB: account already blacklisted");
        
        blacklisted[account] = true;
        emit Blacklisted(account);
    }
    
    /**
     * @dev 从黑名单移除
     * @param account 要移除的地址
     */
    function removeFromBlacklist(address account) external onlyOwner {
        require(blacklisted[account], "RMB: account not blacklisted");
        
        blacklisted[account] = false;
        emit UnBlacklisted(account);
    }
    
    /**
     * @dev 销毁黑名单用户的资金
     * @param blacklistedUser 黑名单用户地址
     */
    function destroyBlackFunds(address blacklistedUser) external onlyOwner {
        require(blacklisted[blacklistedUser], "RMB: account not blacklisted");
        
        uint256 balance = balanceOf(blacklistedUser);
        require(balance > 0, "RMB: no balance to destroy");
        
        _burn(blacklistedUser, balance);
        emit DestroyedBlackFunds(blacklistedUser, balance);
    }
    
    /**
     * @dev 重写转账函数以添加黑名单检查
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
        notBlacklisted(from)
        notBlacklisted(to)
    {
        super._update(from, to, value);
    }
    
    /**
     * @dev 紧急提取ETH (如果有人误转ETH到合约)
     */
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "RMB: no ETH to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "RMB: ETH withdrawal failed");
    }
    
    /**
     * @dev 紧急提取ERC20代币 (如果有人误转其他代币到合约)
     */
    function emergencyWithdrawToken(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "RMB: cannot withdraw own token");
        require(token != address(0), "RMB: invalid token address");
        
        IERC20(token).transfer(owner(), amount);
    }
    
    /**
     * @dev 检查地址是否为铸造者
     */
    function isMinter(address account) external view returns (bool) {
        return minters[account];
    }
    
    /**
     * @dev 检查地址是否在黑名单中
     */
    function isBlacklisted(address account) external view returns (bool) {
        return blacklisted[account];
    }
}