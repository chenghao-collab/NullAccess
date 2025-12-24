import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div className="brand-mark">NA</div>
            <div>
              <h1 className="header-title">NullAccess Vault</h1>
              <p className="header-subtitle">Encrypted IPFS registry with FHE keys</p>
            </div>
          </div>
          <ConnectButton chainStatus="icon" showBalance={false} />
        </div>
      </div>
    </header>
  );
}
