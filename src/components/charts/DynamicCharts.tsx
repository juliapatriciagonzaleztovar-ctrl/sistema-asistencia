"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const RechartsBar = dynamic(() => import("./RechartsCharts").then((m) => m.BarChartComp), { ssr: false, loading: () => <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div> });

const RechartsPie = dynamic(() => import("./RechartsCharts").then((m) => m.PieChartComp), { ssr: false, loading: () => <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div> });

export function DynamicBarChart({ data }: { data: { month: string; presentes: number; ausentes: number }[] }) {
  return <Suspense fallback={null}><RechartsBar data={data} /></Suspense>;
}

export function DynamicPieChart({ present, absent }: { present: number; absent: number }) {
  return <Suspense fallback={null}><RechartsPie present={present} absent={absent} /></Suspense>;
}