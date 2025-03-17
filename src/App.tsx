import './App.css'
import { PrivyProvider } from '@privy-io/react-auth'
import { AuthProvider } from './context/AuthContext'
import ProtectedTodoList from './components/ProtectedTodoList'
import LoginButton from './components/LoginButton'

// This is a placeholder app ID for development/testing
// Replace this with your actual Privy App ID from https://privy.io/
const PRIVY_APP_ID = 'clg1ab1a-b2c3-4d5e-6f7g-8h9i0j1k2lm3'

function App() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#4a76f5',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <AuthProvider>
        <div className="app">
          <LoginButton />
          <ProtectedTodoList />
        </div>
      </AuthProvider>
    </PrivyProvider>
  )
}

export default App
