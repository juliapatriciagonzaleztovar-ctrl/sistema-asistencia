"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserGroupIcon, AcademicCapIcon, BriefcaseIcon, CheckCircleIcon, XCircleIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface Stats { totalChildren: number; totalTeachers: number; totalPractitioners: number; todayPresent: number; todayAbsent: number; }
interface MonthlyData { month: string; presentes: number; ausentes: number; }

function getMonthName(m: number) {
  return ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m];
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ totalChildren: 0, totalTeachers: 0, totalPractitioners: 0, todayPresent: 0, todayAbsent: 0 });
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) return;
    if (user) loadDashboard();
  }, [user, authLoading]);

  async function loadDashboard() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const [childrenSnap, teachersSnap, practitionersSnap, attendanceSnap, staffAttendanceSnap] = await Promise.all([
      getDocs(collection(db, "children")),
      getDocs(collection(db, "teachers")),
      getDocs(collection(db, "practitioners")),
      getDocs(query(collection(db, "attendance_children"), where("attendance_date", "==", today))),
      getDocs(query(collection(db, "attendance_staff"), where("attendance_date", "==", today))),
    ]);

    const childPresent = attendanceSnap.docs.filter((d) => d.data().status === "present").length;
    const childAbsent = attendanceSnap.docs.filter((d) => d.data().status === "absent").length;
    const staffPresent = staffAttendanceSnap.docs.filter((d) => d.data().check_in && d.data().status !== "absent").length;
    const staffAbsent = staffAttendanceSnap.docs.filter((d) => d.data().status === "absent" && !d.data().check_in).length;

    setStats({
      totalChildren: childrenSnap.size,
      totalTeachers: teachersSnap.size,
      totalPractitioners: practitionersSnap.size,
      todayPresent: childPresent + staffPresent,
      todayAbsent: childAbsent + staffAbsent,
    });

    const monthlyData: MonthlyData[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear(); const month = d.getMonth() + 1;
      const sDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const eDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const qMonth = query(collection(db, "attendance_children"), where("attendance_date", ">=", sDate), where("attendance_date", "<", eDate));
      const dataSnap = await getDocs(qMonth);
      monthlyData.push({ month: getMonthName(d.getMonth()), presentes: dataSnap.docs.filter((a) => a.data().status === "present").length, ausentes: dataSnap.docs.filter((a) => a.data().status === "absent").length });
    }
    setMonthly(monthlyData);
    setLoading(false);
  }

  if (loading || authLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const statCards = [
    { title: "Ninos registrados", value: stats.totalChildren, icon: UserGroupIcon, gradient: "gradient-primary" },
    { title: "Profesores", value: stats.totalTeachers, icon: AcademicCapIcon, gradient: "gradient-success" },
    { title: "Practicantes", value: stats.totalPractitioners, icon: BriefcaseIcon, gradient: "gradient-warm" },
    { title: "Asistencias hoy", value: stats.todayPresent, icon: CheckCircleIcon, gradient: "gradient-success" },
    { title: "Ausencias hoy", value: stats.todayAbsent, icon: XCircleIcon, gradient: "gradient-danger" },
  ];

  const totalToday = stats.todayPresent + stats.todayAbsent;
  const attendanceRate = totalToday > 0 ? Math.round((stats.todayPresent / totalToday) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Resumen general del sistema de asistencia</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all animate-fade-in-up">
              <div className="flex items-center gap-3">
                <div className={`${card.gradient} w-11 h-11 rounded-xl flex items-center justify-center shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{card.value}</p>
                  <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-1">{card.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4">
          <ArrowTrendingUpIcon className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Tasa de Asistencia Hoy</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">{stats.todayPresent} de {totalToday} ninos</p>
          </div>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full gradient-primary transition-all duration-1000 ease-out" style={{ width: `${attendanceRate}%` }} />
        </div>
        <p className="text-right text-sm font-bold text-primary mt-2">{attendanceRate}%</p>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm animate-fade-in-up">
        <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Asistencia Mensual (Ultimos 6 meses)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="presentes" name="Presentes" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="ausentes" name="Ausentes" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
