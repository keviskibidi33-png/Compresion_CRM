import { useEffect, useCallback, useState } from 'react';
import { UseFormReturn, FieldValues, DefaultValues } from 'react-hook-form';

const hasNonEmptyString = (value: unknown): boolean =>
    typeof value === 'string' && value.trim() !== '';

const hasCompressionItemData = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;

    const stringFields = [
        'codigo_lem',
        'fecha_ensayo_programado',
        'fecha_ensayo',
        'hora_ensayo',
        'tipo_fractura',
        'defectos',
        'defectos_custom',
        'realizado',
        'revisado',
        'fecha_revisado',
        'aprobado',
        'fecha_aprobado',
    ];

    if (stringFields.some((field) => hasNonEmptyString(item[field]))) return true;

    const numericFields = ['carga_maxima', 'diametro', 'area'];
    return numericFields.some((field) => item[field] !== undefined && item[field] !== null && String(item[field]).trim() !== '');
};

const sanitizeCompressionItems = (items: any[]): any[] => {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const meaningful = safeItems.filter(hasCompressionItemData);

    if (meaningful.length === 0) {
        return [{ item: 1, codigo_lem: '' }];
    }

    return meaningful.map((item, index) => ({
        ...item,
        item: index + 1,
    }));
};

/**
 * Hook to persist form data to localStorage
 * @param formKey Unique key for localStorage
 * @param formMethods react-hook-form methods object
 * @param enabled Whether persistence is enabled
 */
export function useFormPersist<T extends FieldValues>(
    formKey: string,
    formMethods: UseFormReturn<T>,
    enabled: boolean = true
) {
    const { watch, reset } = formMethods;
    const values = watch();
    const [hasSavedData, setHasSavedData] = useState(false);

    // Initial load - Only run once on mount or when key/enabled changes
    useEffect(() => {
        if (!enabled) return;

        const savedData = localStorage.getItem(formKey);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (Array.isArray(parsed?.items)) {
                    parsed.items = sanitizeCompressionItems(parsed.items);
                }
                setHasSavedData(true);
                // Reset form with saved data to populate fields
                reset(parsed as DefaultValues<T>);
            } catch (e) {
                console.error('Error loading saved form data:', e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formKey, enabled]);

    // Save on change (debounced)
    useEffect(() => {
        if (!enabled) return;

        const timeoutId = setTimeout(() => {
            const toSave: any = { ...values };
            if (Array.isArray(toSave.items)) {
                toSave.items = sanitizeCompressionItems(toSave.items);
            }
            localStorage.setItem(formKey, JSON.stringify(toSave));
            setHasSavedData(true);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [values, formKey, enabled]);

    const clearSavedData = useCallback(() => {
        localStorage.removeItem(formKey);
        setHasSavedData(false);
        // Optionally reset form to defaults? 
        // For now, just clear storage. User might want to clear form manually.
        // Actually, "Eliminar Guardado" implies identifying that what is on screen is saved.
        // If they want to clear the screen, they use Reset. 
        // If they want to remove the *backup*, this is it.
    }, [formKey]);

    return {
        clearSavedData,
        hasSavedData
    };
}
