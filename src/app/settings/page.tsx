"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { toast } from "react-hot-toast";
import { logAction } from "@/lib/audit";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";

interface Setting { id: string; setting_key: string; setting_value: string | null; }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const snap = await getDocs(query(collection(getFirebaseDb(), "system_settings"), orderBy("setting_key")));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Setting));
    setSettings(data);
    const formMap: Record<string, string> = {};
    data.forEach((s) => { formMap[s.setting_key] = s.setting_value || ""; });
    setForm(formMap);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        const existing = settings.find((s) => s.setting_key === key);
        if (existing) { await updateDoc(doc(getFirebaseDb(), "system_settings", existing.id), { setting_value: value }); }
        else { await addDoc(collection(getFirebaseDb(), "system_settings"), { setting_key: key, setting_value: value }); }
      }
      await logAction("update", "system_settings", null, form);
      toast.success("Configuracion guardada");
      loadSettings();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
    setSaving(false);
  }

  if (loading) return <LoadingSpinner label="Cargando configuracion..." />;

  const settingFields = [
    { key: "institution_name", label: "Nombre de la institucion", placeholder: "Ej: Instituto Infantil ABC" },
    { key: "institution_address", label: "Direccion", placeholder: "Ej: Calle 123 #456-789" },
    { key: "institution_phone", label: "Telefono", placeholder: "Ej: (601) 123-4567" },
    { key: "morning_start", label: "Hora inicio jornada manana", placeholder: "Ej: 07:00" },
    { key: "morning_end", label: "Hora fin jornada manana", placeholder: "Ej: 12:00" },
    { key: "afternoon_start", label: "Hora inicio jornada tarde", placeholder: "Ej: 13:00" },
    { key: "afternoon_end", label: "Hora fin jornada tarde", placeholder: "Ej: 17:00" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><Cog6ToothIcon className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Configuracion</h1><p className="text-sm text-gray-500 dark:text-gray-400">Ajustes generales del sistema</p></div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center"><Cog6ToothIcon className="w-5 h-5 text-white" /></div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Informacion General</h3>
        </div>
        <div className="space-y-4">
          {settingFields.map((s) => (
            <Input key={s.key} label={s.label} value={form[s.key] || ""} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} placeholder={s.placeholder} />
          ))}
        </div>
        <div className="mt-6 flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2">
            {saving ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>) : "Guardar Configuracion"}
          </button>
        </div>
      </div>
    </div>
  );
}
