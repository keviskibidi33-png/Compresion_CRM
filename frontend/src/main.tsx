import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from 'react-query'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import CompressionForm from './pages/CompresionForm'
import './index.css'

const queryClient = new QueryClient()

// Capture auth token from URL (passed by CRM shell) and persist it
const TokenHandler = () => {
    const [searchParams] = useSearchParams();
    React.useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            console.log('[TokenHandler] Token received from CRM, saving to localStorage');
            localStorage.setItem('token', token);
        }
    }, [searchParams]);
    return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <TokenHandler />
                <Routes>
                    <Route path="/" element={<Navigate to="/compresion" replace />} />
                    <Route path="/compresion" element={<CompressionForm />} />
                    <Route path="/dashboard" element={<CompressionForm />} />
                    <Route path="*" element={<Navigate to="/compresion" replace />} />
                </Routes>
            </BrowserRouter>
            <Toaster position="top-right" />
        </QueryClientProvider>
    </React.StrictMode>,
)
