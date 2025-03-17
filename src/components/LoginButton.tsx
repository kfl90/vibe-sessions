import { useAuth } from '../context/AuthContext';
import '../styles/LoginButton.css';

const LoginButton = () => {
  const { isAuthenticated, login, logout, walletAddress } = useAuth();

  return (
    <div className="login-button-container">
      {isAuthenticated ? (
        <div className="user-info">
          <span className="wallet-address">
            {walletAddress && `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
          </span>
          <button onClick={logout} className="logout-button">
            Disconnect
          </button>
        </div>
      ) : (
        <button onClick={login} className="login-button">
          Connect Wallet
        </button>
      )}
    </div>
  );
};

export default LoginButton; 