import React, { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useFormPersist } from '../hooks/use-form-persist';
import { CompressionExportRequest, compressionApi } from '../services/api';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CheckCircle2, XCircle, FileText, Loader2, Search } from 'lucide-react';

interface CompressionFormInputs extends Omit<CompressionExportRequest, 'items'> {
    items: {
        item: number;
        codigo_lem: string;
        fecha_ensayo?: string;
        hora_ensayo?: string;
        carga_maxima?: number;
        tipo_fractura?: string;
        defectos?: string;
        defectos_custom?: string;
        // New fields
        diametro?: number;
        area?: number;
        realizado?: string;
        revisado?: string;
        fecha_revisado?: string;
        aprobado?: string;
        fecha_aprobado?: string;
    }[];
}

// Personnel options
const REALIZADO_OPTIONS = ['Deyvi Infanzon', 'Ivan Chancon'];
const REVISADO_OPTIONS = ['Fabian la Rosa', 'Irma Coaquira'];
const APROBADO_OPTIONS = ['Fabian la Rosa', 'Irma Coaquira'];
const DEFECTOS_OPTIONS = ['A', 'B', 'C', 'D', 'E'];
const TIPO_FRACTURA_OPTIONS = ['1', '2', '3', '4', '5', '6'];

// Custom date input component with XX/XX/26 format and autocomplete
const DateInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, placeholder = 'dd/mm/aa', className }) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value;

        // Only allow digits and slashes
        input = input.replace(/[^\d/]/g, '');

        // Get only digits for processing
        const digitsOnly = input.replace(/\D/g, '');

        // Build formatted string with auto-slashes
        let formatted = '';
        for (let i = 0; i < digitsOnly.length && i < 6; i++) {
            if (i === 2 || i === 4) {
                formatted += '/';
            }
            formatted += digitsOnly[i];
        }

        // Auto-complete year "26" when user has typed dd/mm (4 digits)
        if (digitsOnly.length === 4) {
            formatted += '/26';
        }

        onChange(formatted);
    };

    return (
        <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder={placeholder}
            className={className}
            maxLength={8}
        />
    );
};

// Custom Codigo LEM input with XXX-CO-26 autocomplete on blur
const CodigoLemInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, placeholder = 'XXX-CO-26', className }) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Allow free typing - just convert to uppercase
        let input = e.target.value.toUpperCase();
        onChange(input);
    };

    // Autocomplete on blur - always append -CO-26 if not already present
    const handleBlur = () => {
        if (value) {
            const trimmed = value.trim();
            // Only autocomplete if doesn't already end with -CO-26
            if (trimmed && !trimmed.endsWith('-CO-26')) {
                onChange(trimmed + '-CO-26');
            }
        }
    };

    return (
        <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={className}
        />
    );
};

// Custom Recepcion input with REC-XXX-26 autocomplete on blur
const RecepcionInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, placeholder = 'REC-XXX-26', className }) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value.toUpperCase();
        onChange(input);
    };

    const handleBlur = () => {
        if (value) {
            const trimmed = value.trim();
            // Add REC- prefix if not present
            let result = trimmed;
            if (!trimmed.startsWith('REC-')) {
                result = 'REC-' + trimmed;
            }
            // Add -26 suffix if not present
            if (!result.endsWith('-26')) {
                result = result + '-26';
            }
            onChange(result);
        }
    };

    return (
        <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={className}
        />
    );
};

// Custom OT input with OT-XXX-26 autocomplete on blur
const OTInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, placeholder = 'OT-XXX-26', className }) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value.toUpperCase();
        onChange(input);
    };

    const handleBlur = () => {
        if (value) {
            const trimmed = value.trim();
            // Add OT- prefix if not present
            let result = trimmed;
            if (!trimmed.startsWith('OT-')) {
                result = 'OT-' + trimmed;
            }
            // Add -26 suffix if not present
            if (!result.endsWith('-26')) {
                result = result + '-26';
            }
            onChange(result);
        }
    };

    return (
        <input
            type="text"
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={className}
        />
    );
};

const CompressionForm: React.FC = () => {
    const { register, control, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<CompressionFormInputs>({
        defaultValues: {
            items: Array.from({ length: 4 }).map((_, i) => ({
                item: i + 1,
                codigo_lem: '',
                fecha_ensayo: '',
                hora_ensayo: '',
                carga_maxima: undefined,
                tipo_fractura: '',
                defectos: '',
                defectos_custom: '',
                realizado: '',
                revisado: '',
                fecha_revisado: '',
                aprobado: '',
                fecha_aprobado: '',
            })),
            recepcion_numero: '',
            ot_numero: '',
            recepcion_id: undefined, // Initialize
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    // Track which rows have "Otro" selected for defectos
    const watchedItems = watch('items');

    // Search status state
    const [recepcionStatus, setRecepcionStatus] = useState<{
        estado: 'idle' | 'buscando' | 'disponible' | 'ocupado';
        mensaje?: string;
        datos?: any;
        formatos?: {
            recepcion: boolean;
            verificacion: boolean;
            compresion: boolean;
        };
    }>({ estado: 'idle' });

    // Check for ID in URL for Edit Mode
    const [editId, setEditId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    React.useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const idParam = searchParams.get('id');

        if (idParam) {
            const id = parseInt(idParam, 10);
            if (!isNaN(id)) {
                setEditId(id);
                loadEnsayo(id);
            }
        }
    }, []);

    const loadEnsayo = async (id: number) => {
        try {
            const loadingToast = toast.loading('Cargando datos del ensayo...');
            const data = await compressionApi.obtenerEnsayo(id);

            // Format dates for form (YYYY-MM-DD -> DD/MM/YY)
            const formatDateForForm = (isoDate?: string | null) => {
                if (!isoDate) return '';
                // Handle different date formats or date objects
                const dateObj = new Date(isoDate);
                // Adjust for timezone issues if needed, or just split string if guaranteed YYYY-MM-DD
                if (typeof isoDate === 'string' && isoDate.includes('-')) {
                    const [y, m, d] = isoDate.split('T')[0].split('-');
                    return `${d}/${m}/${y.slice(2)}`;
                }
                return '';
            };

            // Map API response to Form Inputs
            const formValues: CompressionFormInputs = {
                recepcion_numero: data.numero_recepcion || '',
                ot_numero: data.numero_ot || '',
                recepcion_id: data.recepcion_id, // Load existing ID
                codigo_equipo: data.codigo_equipo || '',
                otros: data.otros || '',
                nota: data.nota || '',
                items: data.items.map((it: any) => ({
                    item: it.item,
                    codigo_lem: it.codigo_lem,
                    fecha_ensayo: formatDateForForm(it.fecha_ensayo),
                    hora_ensayo: it.hora_ensayo || '',
                    carga_maxima: it.carga_maxima,
                    tipo_fractura: it.tipo_fractura,
                    defectos: it.defectos,
                    defectos_custom: it.defectos === 'Otro' ? it.defectos : '',
                    realizado: it.realizado,
                    revisado: it.revisado,
                    fecha_revisado: formatDateForForm(it.fecha_revisado),
                    aprobado: it.aprobado,
                    fecha_aprobado: formatDateForForm(it.fecha_aprobado),

                    diametro: undefined,
                    area: undefined
                }))
            };

            reset(formValues);

            if (data.numero_recepcion) {
                buscarRecepcion(data.numero_recepcion);
            }

            toast.dismiss(loadingToast);
            toast.success('Datos cargados para edición');
        } catch (error) {
            console.error('Error loading ensayo:', error);
            toast.error('Error al cargar la información del ensayo');
            setErrorMessage('No se pudo cargar el ensayo solicitado.');
        }
    };

    // API Base URL (Vite uses import.meta.env)
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // Search recepcion on blur
    const buscarRecepcion = React.useCallback(async (numero: string) => {
        if (!numero || numero.length < 3) return;

        setRecepcionStatus({ estado: 'buscando' });

        try {
            const data = await compressionApi.checkStatus(numero); // Use new standardized endpoint

            if (data.exists) {
                const isVerificacionDone = data.verificacion?.status === 'completado' || data.verificacion?.status === 'aprobado';
                const isCompresionDone = data.compresion?.status === 'completado' || data.compresion?.status === 'en_proceso'; // Check comprehensive status

                let estadoFinal: 'ocupado' | 'disponible' = isCompresionDone ? 'ocupado' : 'disponible';
                let mensajeFinal = isCompresionDone
                    ? `⚠️ Ensayo ya registrado`
                    : '✅ Recepción válida - Disponible para ensayo';

                // Warning if Verification is missing
                if (!isCompresionDone && !isVerificacionDone) {
                    mensajeFinal = '⚠️ Atención: Falta registro de Verificación ⚠️';
                }

                setRecepcionStatus({
                    estado: estadoFinal,
                    mensaje: mensajeFinal,
                    formatos: {
                        recepcion: true, // If exists, reception is done
                        verificacion: isVerificacionDone,
                        compresion: isCompresionDone
                    },
                    datos: data
                });

                // Auto-fill OT if available
                if (data.recepcion?.numero_ot) {
                    setValue('ot_numero', data.recepcion.numero_ot);
                }

                // Set recepcion_id for linkage
                if (data.recepcion?.id) {
                    setValue('recepcion_id', data.recepcion.id);
                }
            } else {
                setRecepcionStatus({
                    estado: 'ocupado', // Treat not found as 'ocupado/error' to show Red X
                    mensaje: '⛔ Recepción no encontrada en el sistema',
                    formatos: {
                        recepcion: false,
                        verificacion: false,
                        compresion: false
                    }
                });
            }

        } catch (error) {
            console.error('Error buscando recepción:', error);
            setRecepcionStatus({
                estado: 'disponible', // Fallback to allow manual entry if API fails? Or block?
                mensaje: '⚠️ Error de conexión - Verifique manualmente'
            });
        }
    }, [setValue]);

    // Función para importar muestras desde la recepción
    const importarMuestras = async () => {
        const recepcion_id = watch('recepcion_id');
        if (!recepcion_id) return;

        try {
            toast.loading('Importando muestras...');
            const orden = await compressionApi.getOrden(recepcion_id);
            toast.dismiss();

            if (orden) {
                const samples = orden.muestras || orden.items || [];
                if (samples.length > 0) {
                    const nuevosItems = samples.map((item: any, idx: number) => ({
                        item: idx + 1,
                        codigo_lem: item.codigo_muestra || item.codigo_muestra_lem || '',
                        fecha_ensayo: '',
                        hora_ensayo: '',
                        carga_maxima: undefined,
                        tipo_fractura: '',
                        defectos: '',
                        defectos_custom: '',
                        realizado: '',
                        revisado: '',
                        fecha_revisado: '',
                        aprobado: '',
                        fecha_aprobado: '',
                        diametro: undefined,
                        area: undefined
                    }));

                    setValue('items', nuevosItems);
                    toast.success(`${nuevosItems.length} muestras importadas correctamente`);
                } else {
                    toast.error('No se encontraron muestras en esta recepción');
                }
            }
        } catch (error) {
            toast.dismiss();
            console.error('Error importando muestras:', error);
            toast.error('Error al importar muestras de recepción');
        }
    };

    // Memoize form methods to avoid re-triggering persistence effects
    const formMethodsMemo = React.useMemo(() => ({
        watch,
        setValue,
        reset: (values: any) => {
            if (values.recepcion_numero) {
                buscarRecepcion(values.recepcion_numero);
            }
            return reset(values);
        }
    }), [watch, setValue, reset, buscarRecepcion]);

    // Local Storage Persistence
    const { clearSavedData, hasSavedData } = useFormPersist("compresion-form-draft", formMethodsMemo as any);

    const handleClearForm = () => {
        clearSavedData();
        reset({
            recepcion_numero: '',
            ot_numero: '',
            recepcion_id: undefined,
            items: [{ item: 1, codigo_lem: '' }],
            codigo_equipo: '',
            otros: '',
            nota: ''
        });
        setRecepcionStatus({ estado: 'idle', mensaje: '', datos: null, formatos: undefined });
    };

    const formatDateToISO = (dateStr?: string) => {
        if (!dateStr || !dateStr.includes('/')) return undefined;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return undefined;
        const [day, month, year] = parts;
        // Assume year '26' -> '2026'
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    const onSubmit = async (data: CompressionFormInputs) => {
        try {
            const loadingToast = toast.loading('Guardando y generando Excel...');

            // Prepare data with correct formats
            const apiData = {
                ...data,
                items: data.items.map(it => ({
                    ...it,
                    item: Number(it.item),
                    // Convert DD/MM/YY to YYYY-MM-DD for backend
                    fecha_ensayo: formatDateToISO(it.fecha_ensayo),
                    fecha_revisado: formatDateToISO(it.fecha_revisado),
                    fecha_aprobado: formatDateToISO(it.fecha_aprobado),
                    carga_maxima: it.carga_maxima ? Number(it.carga_maxima) : undefined,
                    defectos: it.defectos === 'Otro' ? it.defectos_custom : it.defectos,
                    diametro: it.diametro ? Number(it.diametro) : undefined,
                    area: it.area ? Number(it.area) : undefined,
                }))
            };

            // 1. Save to Database first
            try {
                // Pass editId if updating
                await compressionApi.guardarEnsayo(apiData, editId || undefined);
            } catch (saveError) {
                console.error('Error saving to DB:', saveError);
                toast.error('Error al guardar en base de datos, pero intentando generar Excel...');
            }

            // 2. Export to Excel
            const blob = await compressionApi.exportarExcel(apiData as any);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Ensayo_Compresion_${data.recepcion_numero || 'temp'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success('Ensayo guardado y Excel generado exitosamente!', { id: loadingToast });
            if (!editId) {
                handleClearForm(); // Only clear if creating new, keep form if editing
            }
        } catch (error: any) {
            console.error(error);
            // Show more detailed error for 422
            const detail = error.response?.data?.detail;
            let msg = 'Error al procesar el ensayo';
            if (detail) {
                msg += ': ' + (typeof detail === 'string' ? detail : JSON.stringify(detail));
            }
            toast.error(msg);
        }
    };

    const handleCloseModal = () => {
        window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow-sm p-4">
                <div className="max-w-full mx-auto flex justify-between items-center px-4">
                    <h1 className="text-xl font-bold text-gray-900">Módulo de Compresión de Concreto</h1>
                    <div className="flex items-center space-x-2">
                        {/* Saving Indicator / Clear Draft */}
                        {hasSavedData && (
                            <div className="flex items-center mr-4 animate-in fade-in duration-300 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                <span className="text-xs text-amber-700 mr-2 font-medium">Borrador guardado</span>
                                <button
                                    type="button"
                                    onClick={handleClearForm}
                                    className="p-1 text-amber-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    title="Descartar borrador y limpiar formulario"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            title="Cerrar"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full px-4 py-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                    {/* Header Section */}
                    <div className="bg-white shadow rounded-lg p-6 relative">
                        {editId && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 rounded-bl-lg text-xs font-bold uppercase shadow-sm z-10">
                                Modo Edición - ID: {editId}
                            </div>
                        )}
                        <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-8 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                            {/* N° Recepción */}
                            <div className="flex-[2] min-w-0">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 ml-0.5">N° Recepción</label>
                                <div className="relative group">
                                    <Controller
                                        name="recepcion_numero"
                                        control={control}
                                        rules={{ required: 'Requerido' }}
                                        render={({ field }) => (
                                            <input
                                                type="text"
                                                value={field.value || ''}
                                                onChange={(e) => {
                                                    const input = e.target.value.toUpperCase();
                                                    field.onChange(input);
                                                }}
                                                onBlur={(e) => {
                                                    let value = e.target.value.trim().toUpperCase();
                                                    if (!value) {
                                                        field.onChange('');
                                                        return;
                                                    }
                                                    if (!value.startsWith('REC-')) {
                                                        value = 'REC-' + value;
                                                    }
                                                    const hasYearSuffix = /-\d{2}$/.test(value);
                                                    const hasExtendedSuffix = /-\d{2}-[A-Z0-9]+$/.test(value);
                                                    if (!hasYearSuffix && !hasExtendedSuffix) {
                                                        value = value + '-26';
                                                    }
                                                    field.onChange(value);
                                                    buscarRecepcion(value);
                                                }}
                                                placeholder="REC-XXX-26"
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-white pr-24 transition-all"
                                            />
                                        )}
                                    />
                                    {/* Status Indicator inside input container */}
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-end z-10">
                                        {recepcionStatus.estado === 'buscando' && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100 animate-pulse">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">...</span>
                                            </div>
                                        )}
                                        {recepcionStatus.estado === 'disponible' && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border shadow-sm bg-emerald-50 text-emerald-600 border-emerald-100">
                                                <CheckCircle2 className="h-3 w-3" />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">LISTO</span>
                                            </div>
                                        )}
                                        {recepcionStatus.estado === 'ocupado' && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md border border-rose-100 shadow-sm">
                                                <XCircle className="h-3 w-3" />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">EN USO</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {errors.recepcion_numero && <span className="text-red-500 text-[10px] mt-1 block font-medium uppercase">{errors.recepcion_numero.message}</span>}
                            </div>

                            {/* Traceability Matrix Column */}
                            <div className="flex-none pt-6 hidden md:block">
                                <div className="flex flex-col items-center gap-2">
                                    {recepcionStatus.formatos && (
                                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
                                            <div className={`flex items-center justify-center w-8 h-5 rounded text-[9px] font-black border transition-colors ${recepcionStatus.formatos.recepcion ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>REC</div>
                                            <div className={`flex items-center justify-center w-8 h-5 rounded text-[9px] font-black border transition-colors ${recepcionStatus.formatos.verificacion ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>VER</div>
                                            <div className={`flex items-center justify-center w-8 h-5 rounded text-[9px] font-black border transition-colors ${recepcionStatus.formatos.compresion ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>COM</div>
                                        </div>
                                    )}
                                    {recepcionStatus.mensaje && (
                                        <div className={`text-center text-[8px] font-black italic uppercase tracking-tighter max-w-[120px] ${recepcionStatus.estado === 'ocupado' ? 'text-rose-500' : 'text-slate-400'}`}>
                                            {recepcionStatus.mensaje}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* N° OT */}
                            <div className="flex-[2] min-w-0">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 ml-0.5">N° OT</label>
                                <div className="relative">
                                    <Controller
                                        name="ot_numero"
                                        control={control}
                                        rules={{ required: 'Requerido' }}
                                        render={({ field }) => (
                                            <OTInput
                                                value={field.value || ''}
                                                onChange={field.onChange}
                                                placeholder="OT-XXX-26"
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-white"
                                            />
                                        )}
                                    />
                                    {/* Link indicator - subtle visual cue that OT is linked to Reception */}
                                    {watch('recepcion_id') && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 opacity-50">
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded text-[8px] font-bold uppercase tracking-wider border border-emerald-100">
                                                Vinculado
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {errors.ot_numero && <span className="text-red-500 text-[10px] mt-1 block uppercase font-medium">{errors.ot_numero.message}</span>}
                            </div>
                        </div>

                        {/* Import Button Section - Full width under the flex row */}
                        {recepcionStatus.estado === 'disponible' && watch('recepcion_id') && watchedItems.length <= 1 && !watchedItems[0]?.codigo_lem && (
                            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <button
                                    type="button"
                                    onClick={importarMuestras}
                                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98] uppercase tracking-wider"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    <span>Importar Muestras de Recepción</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Items Table */}
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="px-6 py-4 flex justify-between items-center bg-gray-50 border-b border-gray-200">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Items de Ensayo</h3>
                            <button
                                type="button"
                                onClick={() => append({
                                    item: fields.length + 1,
                                    codigo_lem: '',
                                    fecha_ensayo: '',
                                    hora_ensayo: '',
                                    carga_maxima: undefined,
                                    tipo_fractura: '',
                                    defectos: '',
                                    defectos_custom: '',
                                    realizado: '',
                                    revisado: '',
                                    fecha_revisado: '',
                                    aprobado: '',
                                    fecha_aprobado: '',
                                })}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <PlusIcon className="h-4 w-4 mr-2" /> Agregar Fila
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1400px' }}>
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">Item</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Código LEM</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">Fecha Ensayo</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">Hora</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">Carga Máx (KN)</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">Tipo Fractura</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">Defectos</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">Realizado</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">Revisado</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">F. Revisado</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">Aprobado</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">F. Aprobado</th>
                                        <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {fields.map((field, index) => (
                                        <tr key={field.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            {/* Item Number */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <input
                                                    type="number"
                                                    {...register(`items.${index}.item` as const)}
                                                    className="block w-14 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border text-center"
                                                />
                                            </td>

                                            {/* Código LEM */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Controller
                                                    name={`items.${index}.codigo_lem` as const}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <CodigoLemInput
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                            placeholder="XXX-CO-26"
                                                            className="block w-28 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                        />
                                                    )}
                                                />
                                            </td>

                                            {/* Fecha Ensayo */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Controller
                                                    name={`items.${index}.fecha_ensayo` as const}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <DateInput
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                            placeholder="dd/mm/aa"
                                                            className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                        />
                                                    )}
                                                />
                                            </td>

                                            {/* Hora Ensayo */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <input
                                                    type="text"
                                                    {...register(`items.${index}.hora_ensayo` as const)}
                                                    placeholder="0000"
                                                    className="block w-16 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                    inputMode="numeric"
                                                />
                                            </td>

                                            {/* Carga Máxima */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    {...register(`items.${index}.carga_maxima` as const)}
                                                    className="block w-20 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                />
                                            </td>

                                            {/* Tipo Fractura */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <select
                                                    {...register(`items.${index}.tipo_fractura` as const)}
                                                    className="block w-20 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                >
                                                    <option value="">Sel.</option>
                                                    {TIPO_FRACTURA_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Defectos - Dropdown with separate custom input */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex gap-2 items-center">
                                                    <select
                                                        {...register(`items.${index}.defectos` as const)}
                                                        className="block w-20 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                    >
                                                        <option value="">Sel.</option>
                                                        {DEFECTOS_OPTIONS.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                        <option value="Otro">Otro</option>
                                                    </select>
                                                    {watchedItems?.[index]?.defectos === 'Otro' && (
                                                        <input
                                                            type="text"
                                                            {...register(`items.${index}.defectos_custom` as const)}
                                                            placeholder="Escribir..."
                                                            className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                        />
                                                    )}
                                                </div>
                                            </td>

                                            {/* Realizado */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <select
                                                    {...register(`items.${index}.realizado` as const)}
                                                    className="block w-32 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {REALIZADO_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Revisado */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <select
                                                    {...register(`items.${index}.revisado` as const)}
                                                    className="block w-32 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {REVISADO_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Fecha Revisado */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Controller
                                                    name={`items.${index}.fecha_revisado` as const}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <DateInput
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                            placeholder="dd/mm/aa"
                                                            className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                        />
                                                    )}
                                                />
                                            </td>

                                            {/* Aprobado */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <select
                                                    {...register(`items.${index}.aprobado` as const)}
                                                    className="block w-32 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {APROBADO_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Fecha Aprobado */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Controller
                                                    name={`items.${index}.fecha_aprobado` as const}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <DateInput
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                            placeholder="dd/mm/aa"
                                                            className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2 border"
                                                        />
                                                    )}
                                                />
                                            </td>

                                            {/* Delete Button */}
                                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="text-red-600 hover:text-red-900 p-1"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Código Equipo Utilizado</label>
                                <input
                                    type="text"
                                    {...register('codigo_equipo')}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Otros (35 I-J)</label>
                                <input
                                    type="text"
                                    {...register('otros')}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nota (37 D)</label>
                                <textarea
                                    {...register('nota')}
                                    rows={3}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>Generando...</>
                            ) : (
                                <>
                                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                                    Generar Excel
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
};

export default CompressionForm;
