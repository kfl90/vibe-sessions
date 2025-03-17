import { useAuth } from '../context/AuthContext';
import TodoList from './TodoList';
import '../styles/ProtectedTodoList.css';

const ProtectedTodoList = () => {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="login-required">
        <h2>Login Required</h2>
        <p>Please connect your wallet to access your todo list.</p>
        <button onClick={login} className="login-cta">
          Connect Wallet
        </button>
      </div>
    );
  }

  return <TodoList />;
};

export default ProtectedTodoList; 