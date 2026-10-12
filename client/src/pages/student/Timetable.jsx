import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, BookOpen, RefreshCw } from 'lucide-react';
import { api } from '../../api/client.js';

export default function Timetable() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/courses');
        setCourses(res.courses || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col items-center">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-2" />
        <p className="text-xs text-slate-500">Loading weekly timetable...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Weekly Academic Timetable
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Your scheduled lectures and classrooms for current semester
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {daysOfWeek.map((day) => {
          // Find all classes on this day across enrolled courses
          const dayClasses = [];
          courses.forEach((c) => {
            (c.schedule || []).forEach((slot) => {
              if (slot.day === day) {
                dayClasses.push({
                  course: c,
                  slot,
                });
              }
            });
          });

          // Sort by start time
          dayClasses.sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));

          return (
            <div
              key={day}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 flex flex-col"
            >
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{day}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  {dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'}
                </span>
              </div>

              <div className="mt-3 space-y-3 flex-1">
                {dayClasses.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">No lectures scheduled.</div>
                ) : (
                  dayClasses.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{item.course.code}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 line-clamp-1">
                        {item.course.name}
                      </p>
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{item.slot.startTime} - {item.slot.endTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{item.slot.room || item.course.roomDefault}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
