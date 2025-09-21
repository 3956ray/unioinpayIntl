// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * 说明：
 * - 教学/参考用：未审计，生产请审计并完善风控与合规模块（如清算、黑名单双人复核、KYC 钩子等）。
 * - 依赖：OpenZeppelin Upgradeable 库
 *   forge:  forge install OpenZeppelin/openzeppelin-contracts-upgradeable
 *   npm :   npm i @openzeppelin/contracts-upgradeable
 */

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {SafeERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract RMBTokenV1 is
    Initializable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    PausableUpgradeable,
    AccessControlEnumerableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // -------- Roles --------
    bytes32 public constant PAUSER_ROLE     = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE     = keccak256("MINTER_ROLE");
    bytes32 public constant BLACKLISTER_ROLE= keccak256("BLACKLISTER_ROLE");
    bytes32 public constant RESCUER_ROLE    = keccak256("RESCUER_ROLE");
    bytes32 public constant UPGRADER_ROLE   = keccak256("UPGRADER_ROLE");
    bytes32 public constant BURNER_ROLE     = keccak256("BURNER_ROLE");

    // -------- Compliance / Blacklist --------
    mapping(address => bool) private _blacklisted;
    
    // -------- Supply Control --------
    uint256 private _maxSupply;
    bool private _supplyCapEnabled;
    
    // -------- Contract Metadata --------
    string private constant _VERSION = "1.0.0";
    string private _contractURI;

    // -------- Events --------
    event Blacklisted(address indexed account, bool isBlacklisted);
    event Rescued(address indexed token, address indexed to, uint256 amount);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event MaxSupplyUpdated(uint256 oldMaxSupply, uint256 newMaxSupply);
    event SupplyCapToggled(bool enabled);

    // -------- Initializer (instead of constructor) --------
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // 防止实现合约被直接初始化
    }

    /**
     * 初始化函数（仅可调用一次）
     * @param admin   初始管理员（DEFAULT_ADMIN_ROLE）
     * @param name_   代币名，比如 "RMB Stablecoin"
     * @param symbol_ 代币符号，比如 "RMB"
     */
    function initialize(address admin, string memory name_, string memory symbol_) public initializer {
        require(admin != address(0), "RMB: admin cannot be zero address");

        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);            // EIP-2612 Domain
        __Pausable_init();
        __AccessControlEnumerable_init();
        __UUPSUpgradeable_init();

        // 设置初始管理员角色
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        
        // 初始化供应量控制（默认不启用上限）
        _maxSupply = 0;
        _supplyCapEnabled = false;
        
        // 设置默认合约元数据URI
        _contractURI = "";
        
        // 精度：与 USDC 对齐为 6
        // OZ v5 的 ERC20 默认 decimals=18；重写需要 OZ v5.0+ 的可选扩展，或手动覆写 decimals()
        // 这里直接覆写
    }

    // USDC 为 6 位小数
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // -------- Admin / Roles 配置 --------
    function setupRoles(address admin, address pauser, address minter, address blacklister, address rescuer, address upgrader, address burner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // 允许多次增配/换人，生产可细化为单独的 grant/revoke
        if (admin != address(0))       _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (pauser != address(0))      _grantRole(PAUSER_ROLE, pauser);
        if (minter != address(0))      _grantRole(MINTER_ROLE, minter);
        if (blacklister != address(0)) _grantRole(BLACKLISTER_ROLE, blacklister);
        if (rescuer != address(0))     _grantRole(RESCUER_ROLE, rescuer);
        if (upgrader != address(0))    _grantRole(UPGRADER_ROLE, upgrader);
        if (burner != address(0))      _grantRole(BURNER_ROLE, burner);
    }

    // -------- Pause 控制 --------
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // -------- Blacklist 控制 --------
    function setBlacklisted(address account, bool isBlacklisted) external onlyRole(BLACKLISTER_ROLE) {
        require(account != address(0), "RMB: account cannot be zero address");
        _blacklisted[account] = isBlacklisted;
        emit Blacklisted(account, isBlacklisted);
    }

    function setBlacklistedBatch(address[] calldata accounts, bool isBlacklisted) external onlyRole(BLACKLISTER_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "RMB: account cannot be zero address");
            _blacklisted[accounts[i]] = isBlacklisted;
            emit Blacklisted(accounts[i], isBlacklisted);
        }
    }

    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }
    
    // -------- Supply Control --------
    function setMaxSupply(uint256 newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxSupply == 0 || newMaxSupply >= totalSupply(), "RMB: max supply cannot be less than current supply");
        uint256 oldMaxSupply = _maxSupply;
        _maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(oldMaxSupply, newMaxSupply);
    }
    
    function toggleSupplyCap(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _supplyCapEnabled = enabled;
        emit SupplyCapToggled(enabled);
    }
    
    function maxSupply() public view returns (uint256) {
        return _maxSupply;
    }
    
    function supplyCapEnabled() public view returns (bool) {
        return _supplyCapEnabled;
    }
    
    // -------- Contract Metadata --------
    function version() public pure returns (string memory) {
        return _VERSION;
    }
    
    function contractURI() public view returns (string memory) {
        return _contractURI;
    }
    
    function setContractURI(string calldata newContractURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _contractURI = newContractURI;
    }
    
    // -------- View Functions --------
    function getContractInfo() external view returns (
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        uint256 maxSupply_,
        bool supplyCapEnabled_,
        string memory version_
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            _maxSupply,
            _supplyCapEnabled,
            _VERSION
        );
    }

    // -------- Mint / Burn（与 USDC 风格一致：受控铸销） --------
    function mint(address to, uint256 amount) external whenNotPaused onlyRole(MINTER_ROLE) {
        require(to != address(0), "RMB: mint to zero address");
        require(!isBlacklisted(to), "RMB: recipient is blacklisted");
        require(amount > 0, "RMB: mint amount must be greater than 0");
        
        // 检查供应量上限
        if (_supplyCapEnabled && _maxSupply > 0) {
            require(totalSupply() + amount <= _maxSupply, "RMB: mint would exceed max supply");
        }
        
        _mint(to, amount);
        emit Mint(to, amount);
    }

    // 受控销毁（由 BURNER_ROLE 触发，针对指定账户）
    function burnFromAddress(address from, uint256 amount) external whenNotPaused onlyRole(BURNER_ROLE) {
        require(from != address(0), "RMB: burn from zero address");
        require(!isBlacklisted(from), "RMB: account is blacklisted");
        require(amount > 0, "RMB: burn amount must be greater than 0");
        _burn(from, amount);
        emit Burn(from, amount);
    }

    // 持币人自愿销毁（可选）
    function burn(uint256 amount) external whenNotPaused {
        require(!isBlacklisted(msg.sender), "RMB: caller is blacklisted");
        require(amount > 0, "RMB: burn amount must be greater than 0");
        _burn(msg.sender, amount);
        emit Burn(msg.sender, amount);
    }

    // -------- 资产找回（Rescue）--------
    // 找回误转到合约地址上的 ERC20
    function rescueERC20(address token, address to, uint256 amount) external onlyRole(RESCUER_ROLE) {
        require(token != address(0), "RMB: token cannot be zero address");
        require(to != address(0), "RMB: recipient cannot be zero address");
        require(amount > 0, "RMB: amount must be greater than 0");
        require(token != address(this), "RMB: cannot rescue self token");
        IERC20Upgradeable(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }

    // 找回误转到合约地址上的原生币（如 ETH）
    receive() external payable {}
    function rescueETH(address payable to, uint256 amount) external onlyRole(RESCUER_ROLE) {
        require(to != address(0), "RMB: recipient cannot be zero address");
        require(amount > 0, "RMB: amount must be greater than 0");
        require(address(this).balance >= amount, "RMB: insufficient contract balance");
        (bool ok,) = to.call{value: amount}("");
        require(ok, "RMB: ETH transfer failed");
        emit Rescued(address(0), to, amount);
    }

    // -------- 内部钩子：统一合规检查 --------
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override
        whenNotPaused
    {
        require(!isBlacklisted(from), "RMB: sender is blacklisted");
        require(!isBlacklisted(to), "RMB: recipient is blacklisted");
        super._beforeTokenTransfer(from, to, amount);
    }

    // permit 也需要做黑名单/暂停限制（OZ 内部在 _update/_spendAllowance 前后触发 _beforeTokenTransfer，
    // 但对 approve 不会触发转账钩子，因此单独拦一下更稳）
    function _approve(address owner, address spender, uint256 value) internal override {
        require(!isBlacklisted(owner), "RMB: owner is blacklisted");
        require(!isBlacklisted(spender), "RMB: spender is blacklisted");
        super._approve(owner, spender, value);
    }

    // -------- UUPS 鉴权 --------
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // -------- 存储预留，便于未来升级 --------
    uint256[50] private __gap;
}
