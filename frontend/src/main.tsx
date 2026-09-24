import { ApolloProvider } from '@apollo/client/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { client } from './apollo/client';
import { AuthProvider } from './auth/AuthContext';
import './index.css';

// ApolloProvider en la RAÍZ del árbol: toda la app comparte un único
// cliente y una única caché normalizada (Apollo Context).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
);
