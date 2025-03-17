import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { 
  createSmartAccountClient,
} from 'permissionless';
import { 
  signerToEcdsaKernelSmartAccount,
} from 'permissionless/accounts';
import { privateKeyToSmartAccountSigner } from 'permissionless/utils';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Define types for our context
interface SmartAccountContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  smartAccount: any; // Smart account instance
  address: string | null;
  isLoading: boolean;
}

// Create context with default values
const SmartAccountContext = createContext<SmartAccountContextType>({
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  smartAccount: null,
  address: null,
  isLoading: true,
});

// Provider component
export const SmartAccountProvider = ({ children }: { children: ReactNode }) => {
  const { 
    login, 
    logout, 
    authenticated: isAuthenticated, 
    user, 
    ready
  } = usePrivy();
  
  const [smartAccount, setSmartAccount] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Set up the public client
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  // Initialize smart account when authentication state changes
  useEffect(() => {
    const initializeSmartAccount = async () => {
      if (!isAuthenticated || !user || !ready) {
        setSmartAccount(null);
        setAddress(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // For demo purposes, we're using a hardcoded private key
        // In production, you would get this from the Privy wallet
        const demoPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234';
        
        // Convert wallet client to permissionless signer
        const signer = privateKeyToSmartAccountSigner(demoPrivateKey);
        
        // Create ECDSA Kernel account (previously SimpleAccount)
        const ecdsaKernelAccount = await signerToEcdsaKernelSmartAccount(publicClient, {
          signer,
          entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", // Entry point contract address
          index: 0n, // Salt value
        });

        // Set up Pimlico client
        const pimlicoClient = createPimlicoClient({
          apiKey: "YOUR_PIMLICO_API_KEY",
          transport: http(),
          chain: base,
        });

        // Create smart account client
        const smartAccountClient = createSmartAccountClient({
          account: ecdsaKernelAccount,
          chain: base,
          transport: http(),
          sponsorUserOperation: pimlicoClient.sponsorUserOperation,
        });

        setSmartAccount(smartAccountClient);
        setAddress(ecdsaKernelAccount.address);
      } catch (error) {
        console.error("Failed to initialize smart account:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSmartAccount();
  }, [isAuthenticated, user, ready]);

  const value = {
    isAuthenticated,
    login,
    logout,
    smartAccount,
    address,
    isLoading,
  };

  return (
    <SmartAccountContext.Provider value={value}>
      {children}
    </SmartAccountContext.Provider>
  );
};

// Custom hook to use the smart account context
export const useSmartAccount = () => useContext(SmartAccountContext); 