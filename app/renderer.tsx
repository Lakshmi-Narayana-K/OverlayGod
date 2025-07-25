import React from 'react'
import ReactDOM from 'react-dom/client'
import appIcon from '@/resources/build/icon.png'
import { WindowContextProvider, menuItems } from '@/lib/window'
import App from './app'
import { UIStateProvider } from './state/UIStateProvider'
import './styles/app.css'

console.timeEnd('renderer bootstrap');
console.time('react mount');
ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <UIStateProvider>
      <WindowContextProvider titlebar={{ title: 'Electron React App', icon: appIcon, menuItems }}>
        <App />
      </WindowContextProvider>
    </UIStateProvider>
  </React.StrictMode>
)
console.timeEnd('react mount');
