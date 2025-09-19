import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="app">
        <header className="app-header">
          <h1>UnioinPay International</h1>
          <p>区块链支付解决方案</p>
        </header>
        
        <main className="app-main">
          <div className="card">
            <h2>欢迎使用 UnioinPay</h2>
            <p>这是一个基于区块链的国际支付平台</p>
            
            <div className="counter-section">
              <button onClick={() => setCount((count) => count + 1)}>
                计数器: {count}
              </button>
            </div>
            
            <div className="features">
              <h3>主要功能</h3>
              <ul>
                <li>智能合约集成</li>
                <li>多币种支持</li>
                <li>安全交易</li>
                <li>实时汇率</li>
              </ul>
            </div>
          </div>
        </main>
        
        <footer className="app-footer">
          <p>&copy; 2024 UnioinPay International. All rights reserved.</p>
        </footer>
      </div>
    </>
  )
}

export default App