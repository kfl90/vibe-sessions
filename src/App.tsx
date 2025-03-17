import './App.css'
import { PrivyProvider } from '@privy-io/react-auth'
import { AuthProvider } from './context/AuthContext'
import ProtectedTodoList from './components/ProtectedTodoList'
import LoginButton from './components/LoginButton'

// Replace with your actual Privy App ID
const PRIVY_APP_ID = 'your-privy-app-id-here'

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
