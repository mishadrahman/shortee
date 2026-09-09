import React from 'react';

export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      {/* Top Breadcrumb & Action Placeholder */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Hero Link Header Card Skeleton */}
      <div className="p-6 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
            <div className="h-8 w-3/4 max-w-md bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-full max-w-lg bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            <div className="flex items-center gap-4 pt-1">
              <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
              <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 4 Key Metrics Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="flex items-baseline gap-2">
              <div className="h-9 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>
            <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
        ))}
      </div>

      {/* Analytics Chart Container Skeleton */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3.5 w-64 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
            <div className="h-7 w-16 bg-white dark:bg-slate-700 rounded-lg" />
            <div className="h-7 w-16 bg-transparent rounded-lg" />
            <div className="h-7 w-16 bg-transparent rounded-lg" />
          </div>
        </div>
        <div className="h-64 sm:h-72 w-full bg-slate-50 dark:bg-slate-800/30 rounded-xl flex items-end p-4 gap-3">
          {[40, 65, 30, 80, 55, 90, 75].map((val, idx) => (
            <div
              key={idx}
              className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-t-md"
              style={{ height: `${val}%` }}
            />
          ))}
        </div>
      </div>

      {/* 4 Breakdown Grid Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((row) => (
                <div key={row} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    <div className="h-3.5 w-8 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Activity Log Stream Skeleton */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-44 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
                </div>
              </div>
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
