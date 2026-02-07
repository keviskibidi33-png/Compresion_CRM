import React, { useState } from 'react';
import { useForm, useFieldArray, useWatch, Control } from 'react-hook-form';
import { CompressionExportRequest, compressionApi } from '../services/api';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'; // Using 24 instead of updated naming if v1 or v2

interface CompressionFormInputs extends Omit<CompressionExportRequest, 'items'> {
    items: {
        item: number;
        codigo_lem: string;
        fecha_ensayo?: string;
        hora_ensayo?: string;
        carga_maxima?: number;
        tipo_fractura?: string;
        defectos?: string;
        realizado?: string;
        revisado?: string;
        fecha_revisado?: string;
        aprobado?: string;
        fecha_aprobado?: string;
    }[];
}

const CompressionForm: React.FC = () => {
    const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<CompressionFormInputs>({
        defaultValues: {
            items: Array.from({ length: 4 }).map((_, i) => ({ item: i + 1, codigo_lem: '' })), // Default 4 rows
            recepcion_numero: '',
            ot_numero: '',
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    const onSubmit = async (data: CompressionFormInputs) => {
        try {
            const loadingToast = toast.loading('Generando Excel...');

            // Convert to API expected types (ensure numbers are numbers)
            const apiData: CompressionExportRequest = {
                ...data,
                items: data.items.map(it => ({
                    ...it,
                    item: Number(it.item),
                    carga_maxima: it.carga_maxima ? Number(it.carga_maxima) : undefined,
                    fecha_ensayo: it.fecha_ensayo || undefined,
                    fecha_revisado: it.fecha_revisado || undefined,
                    fecha_aprobado: it.fecha_aprobado || undefined,
                }))
            };

            const blob = await compressionApi.exportarExcel(apiData);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Ensayo_Compresion_${data.recepcion_numero || 'temp'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success('Excel generado exitosamente!', { id: loadingToast });
        } catch (error) {
            console.error(error);
            toast.error('Error al generar Excel');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow-sm p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-900">Módulo de Compresión de Concreto</h1>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                    {/* Header Section */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">N° Recepción</label>
                                <input
                                    type="text"
                                    {...register('recepcion_numero', { required: 'Requerido' })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    placeholder="Ej: REC-2023-001"
                                />
                                {errors.recepcion_numero && <span className="text-red-500 text-xs">{errors.recepcion_numero.message}</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">N° OT</label>
                                <input
                                    type="text"
                                    {...register('ot_numero', { required: 'Requerido' })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    placeholder="Ej: OT-12345"
                                />
                                {errors.ot_numero && <span className="text-red-500 text-xs">{errors.ot_numero.message}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-gray-50 border-b border-gray-200">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Items de Ensayo</h3>
                            <button
                                type="button"
                                onClick={() => append({ item: fields.length + 1, codigo_lem: '' })}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <PlusIcon className="h-4 w-4 mr-1" /> Agregar Fila
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Código LEM</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Ensayo</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carga Máx (KN)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Fractura</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Defectos</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Realizado</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revisado</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">F. Rev.</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aprobado</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">F. Apr.</th>
                                        <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {fields.map((field, index) => (
                                        <tr key={field.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 w-12">
                                                <input
                                                    type="number"
                                                    {...register(`items.${index}.item` as const)}
                                                    className="block w-full border-0 p-0 text-gray-900 placeholder-gray-500 focus:ring-0 sm:text-sm bg-transparent"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="text"
                                                    {...register(`items.${index}.codigo_lem` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="date"
                                                    {...register(`items.${index}.fecha_ensayo` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="time"
                                                    {...register(`items.${index}.hora_ensayo` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    {...register(`items.${index}.carga_maxima` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border w-20"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <select
                                                    {...register(`items.${index}.tipo_fractura` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border w-24"
                                                >
                                                    <option value="">Sel.</option>
                                                    <option value="1">1</option>
                                                    <option value="2">2</option>
                                                    <option value="3">3</option>
                                                    <option value="4">4</option>
                                                    <option value="5">5</option>
                                                    <option value="6">6</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="text"
                                                    {...register(`items.${index}.defectos` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="text"
                                                    {...register(`items.${index}.realizado` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border w-20"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="text"
                                                    {...register(`items.${index}.revisado` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border w-20"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="date"
                                                    {...register(`items.${index}.fecha_revisado` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="text"
                                                    {...register(`items.${index}.aprobado` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border w-20"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <input
                                                    type="date"
                                                    {...register(`items.${index}.fecha_aprobado` as const)}
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs p-1 border"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="text-red-600 hover:text-red-900"
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
                                <label className="block text-sm font-medium text-gray-700">Código Equipo Utilizado</label>
                                <input
                                    type="text"
                                    {...register('codigo_equipo')}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Otros (35 I-J)</label>
                                <input
                                    type="text"
                                    {...register('otros')}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Nota (37 D)</label>
                                <textarea
                                    {...register('nota')}
                                    rows={3}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
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
