import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

const TOKEN_REFRESH_TIMEOUT_MS = 2500
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000

type AuthenticatedRequestConfig = {
    _authRetried?: boolean
    headers?: Record<string, any>
    method?: string
    url?: string
}

const getStoredToken = (): string | null => {
    if (typeof window === 'undefined') return null
    const token = localStorage.getItem('token')?.trim()
    return token ? token : null
}

const persistToken = (token: string | null) => {
    if (typeof window === 'undefined') return
    if (token) {
        localStorage.setItem('token', token)
        return
    }
    localStorage.removeItem('token')
}

const decodeJwtExp = (token: string | null): number | null => {
    if (!token) return null

    try {
        const [, payload] = token.split('.')
        if (!payload) return null

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
        const decoded = JSON.parse(window.atob(padded))

        return typeof decoded?.exp === 'number' ? decoded.exp * 1000 : null
    } catch {
        return null
    }
}

const isTokenExpiringSoon = (token: string | null, skewMs = TOKEN_EXPIRY_SKEW_MS): boolean => {
    const exp = decodeJwtExp(token)
    if (!exp) return !token
    return exp <= Date.now() + skewMs
}

const requestTokenFromParent = async (reason: string): Promise<string | null> => {
    const existingToken = getStoredToken()

    if (typeof window === 'undefined' || window.parent === window) {
        return existingToken
    }

    const requestId = `legacy-${reason}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    return new Promise((resolve) => {
        let settled = false

        const cleanup = () => {
            window.removeEventListener('message', onMessage)
            clearTimeout(timeoutId)
        }

        const finish = (token: string | null) => {
            if (settled) return
            settled = true
            cleanup()
            if (token) persistToken(token)
            resolve(token ?? getStoredToken())
        }

        const onMessage = (event: MessageEvent) => {
            if (event.data?.type !== 'TOKEN_REFRESH') return

            const responseRequestId = typeof event.data?.requestId === 'string' ? event.data.requestId : null
            if (responseRequestId && responseRequestId !== requestId) return

            const token = typeof event.data?.token === 'string' && event.data.token.trim()
                ? event.data.token.trim()
                : null

            finish(token)
        }

        const timeoutId = window.setTimeout(() => {
            finish(existingToken)
        }, TOKEN_REFRESH_TIMEOUT_MS)

        window.addEventListener('message', onMessage)

        try {
            window.parent.postMessage(
                {
                    type: 'TOKEN_REFRESH_REQUEST',
                    requestId,
                    source: 'legacy-auth-api',
                    reason,
                },
                '*',
            )
        } catch {
            finish(existingToken)
        }
    })
}

const resolveAccessToken = async (reason: string): Promise<string | null> => {
    const storedToken = getStoredToken()
    if (!isTokenExpiringSoon(storedToken)) {
        return storedToken
    }

    const refreshedToken = await requestTokenFromParent(reason)
    return refreshedToken ?? storedToken
}
;

// Interceptor to attach auth token on every request

api.interceptors.request.use(
    async (config: any) => {
        const token = await resolveAccessToken(`request:${config.method ?? 'get'}:${config.url ?? ''}`)
        if (token) {
            config.headers = config.headers ?? {}
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error),
)

api.interceptors.response.use(
    (response) => response,
    async (error: any) => {
        const originalRequest = error.config as AuthenticatedRequestConfig | undefined

        if (error.response?.status === 401 && originalRequest && !originalRequest._authRetried) {
            originalRequest._authRetried = true

            const refreshedToken = await requestTokenFromParent('401-retry')
            if (refreshedToken) {
                originalRequest.headers = originalRequest.headers ?? {}
                originalRequest.headers.Authorization = `Bearer ${refreshedToken}`
                return api.request(originalRequest as any)
            }
        }

        if (error.response?.status === 401) {
            window.dispatchEvent(new CustomEvent('session-expired'))
        }
        return Promise.reject(error)
    },
)

const extractFilename = (contentDisposition?: string): string | undefined => {
    const match = typeof contentDisposition === 'string' ? contentDisposition.match(/filename=\"?([^\";]+)\"?/i) : null;
    return match?.[1];
};

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
        item.hora_ensayo,
        item.tipo_fractura,
        item.defectos,
        item.realizado,
        item.revisado,
        item.aprobado,
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
        const filename = extractFilename(response.headers['content-disposition']);
        return { blob: response.data, filename };
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
