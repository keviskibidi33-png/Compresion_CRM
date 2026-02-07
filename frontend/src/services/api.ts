import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Add response interceptor for better error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export interface CompressionItem {
    item: number;
    codigo_lem: string;
    fecha_ensayo?: string; // YYYY-MM-DD
    hora_ensayo?: string;
    carga_maxima?: number;
    tipo_fractura?: string;
    defectos?: string;
    realizado?: string;
    revisado?: string;
    fecha_revisado?: string;
    aprobado?: string;
    fecha_aprobado?: string;
}

export interface CompressionExportRequest {
    recepcion_numero: string;
    ot_numero: string;
    items: CompressionItem[];
    codigo_equipo?: string;
    otros?: string;
    nota?: string;
}

export const compressionApi = {
    exportarExcel: async (data: CompressionExportRequest) => {
        const response = await api.post('/compresion/export', data, {
            responseType: 'blob',
        });
        return response.data;
    },
};

export default api;
