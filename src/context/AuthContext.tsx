import { createContext, useContext, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';

// Define types for our context
interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  user: any;
  isLoading: boolean;
  walletAddress: string | null;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  user: null,
  isLoading: true,
  walletAddress: null,
});

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { 
    login, 
    logout, 
    authenticated: isAuthenticated, 
    user, 
    ready,
  } = usePrivy();

  // Get the first wallet address if available
  const walletAddress = user?.wallet?.address || null;

  const value = {
    isAuthenticated,
    login,
    logout,
    user,
    isLoading: !ready,
    walletAddress,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext); 