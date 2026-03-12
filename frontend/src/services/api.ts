import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Interceptor to attach auth token on every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add response interceptor for better error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.error('[Auth] Session expired — showing modal');
            window.dispatchEvent(new CustomEvent('session-expired'));
        }
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export interface CompressionItem {
    item: number;
    codigo_lem: string;
    fecha_ensayo_programado?: string; // YYYY-MM-DD
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

export interface OrdenTrabajo {
    id: number;
    numero_ot: string;
    numero_recepcion: string;
    items: any[];
    muestras?: MuestraConcreto[];
    fecha_recepcion?: string;
}

export interface MuestraConcreto {
    id: number;
    item_numero: number;
    codigo_muestra: string;
    codigo_muestra_lem?: string;
    identificacion_muestra: string;
    estructura: string;
    fc_kg_cm2: number;
    fecha_moldeo: string;
    hora_moldeo?: string;
    edad: number;
    fecha_rotura: string;
    requiere_densidad: boolean;
}

export interface CompressionExportRequest {
    recepcion_numero: string;
    ot_numero: string;
    items: CompressionItem[];
    codigo_equipo?: string;
    otros?: string;
    nota?: string;
    recepcion_id?: number; // Added to link with reception
}

const isPlaceholderCodigoLem = (value: unknown): boolean => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === '' || normalized === '-') return true;
    return /^X{2,}(?:-CO(?:-\d{2})?)?$/.test(normalized);
};

const hasCompressionItemData = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;

    const hasCodigoUtil = !isPlaceholderCodigoLem(item.codigo_lem);
    const textFields = [
        item.fecha_ensayo_programado,
        item.fecha_ensayo,
        item.hora_ensayo,
        item.tipo_fractura,
        item.defectos,
        item.realizado,
        item.revisado,
        item.fecha_revisado,
        item.aprobado,
        item.fecha_aprobado,
    ];

    if (hasCodigoUtil || textFields.some((value) => typeof value === 'string' && value.trim() !== '')) {
        return true;
    }

    const numericFields = [item.carga_maxima, item.diametro, item.area];
    return numericFields.some((value) => value !== undefined && value !== null && String(value).trim() !== '');
};

export const compressionApi = {
    exportarExcel: async (data: CompressionExportRequest) => {
        const response = await api.post('/api/compresion/export', data, {
            responseType: 'blob',
        });
        return response.data;
    },
    guardarEnsayo: async (data: any, id?: number) => {
        const sanitizedItems = (Array.isArray(data.items) ? data.items : [])
            .filter((item) => hasCompressionItemData(item))
            .map((item: any, index: number) => {
                const parsedItem = Number(item?.item ?? item?.item_numero);
                const normalizedItem = Number.isFinite(parsedItem) && parsedItem > 0 ? parsedItem : index + 1;
                return {
                    ...item,
                    item: normalizedItem,
                    codigo_lem: String(item.codigo_lem || '').trim().toUpperCase(),
                };
            });

        if (sanitizedItems.length === 0) {
            throw new Error('Debe completar al menos una fila válida antes de guardar.');
        }

        // Prepare data for the backend
        const backendData = {
            numero_ot: data.ot_numero,
            numero_recepcion: data.recepcion_numero,
            recepcion_id: data.recepcion_id, // Ensure this is sent if available
            codigo_equipo: data.codigo_equipo,
            otros: data.otros,
            nota: data.nota,
            items: sanitizedItems.map((it: any) => ({
                item: it.item,
                codigo_lem: it.codigo_lem,
                fecha_ensayo_programado: it.fecha_ensayo_programado,
                fecha_ensayo: it.fecha_ensayo,
                hora_ensayo: it.hora_ensayo,
                carga_maxima: it.carga_maxima,
                tipo_fractura: it.tipo_fractura,
                defectos: it.defectos,
                realizado: it.realizado,
                revisado: it.revisado,
                fecha_revisado: it.fecha_revisado,
                aprobado: it.aprobado,
                fecha_aprobado: it.fecha_aprobado
            }))
        };

        if (id) {
            // Update existing
            const response = await api.put(`/api/compresion/${id}`, backendData);
            return response.data;
        } else {
            // Create new
            const response = await api.post('/api/compresion/', backendData);
            return response.data;
        }
    },
    obtenerEnsayo: async (id: number) => {
        const response = await api.get(`/api/compresion/${id}`);
        return response.data;
    },
    listarEnsayos: async (skip = 0, limit = 100) => {
        const response = await api.get(`/api/compresion/?skip=${skip}&limit=${limit}`);
        return response.data;
    },
    getOrden: async (id: number): Promise<OrdenTrabajo> => {
        const response = await api.get(`/api/recepcion/${id}`);
        return response.data;
    },
    checkStatus: async (numero: string): Promise<any> => {
        const response = await api.get(`/api/tracing/validate/${numero}`);
        return response.data;
    },
    getSuggestions: async (query: string): Promise<any[]> => {
        const response = await api.get(`/api/tracing/suggest?q=${query}`);
        return response.data;
    },
};

export default api;
