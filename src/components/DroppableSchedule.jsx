import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Check, AlertTriangle } from 'lucide-react';
import DraggableMember from './DraggableMember';

export default function DroppableSchedule({ schedule, onComplete, onForceConfirm }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `schedule-${schedule.id}`,
  });

  const members = schedule.members || [];
  // 현재 스케줄 내의 총 차키 개수 합산
  const keyCount = members.reduce((sum, m) => sum + (m.keyCount || 0), 0);
  
  // 상태 계산 로직 (hasBeenConfirmed 플래그 또는 3인 이상이면 확정 조건 충족)
  let status = '대기';
  if (schedule.hasBeenConfirmed || members.length >= 3) {
    status = keyCount === 0 ? 'SOS' : '확정';
  }

  // 상태에 따른 테마 색상 적용
  let borderClass = 'border-slate-200';
  let labelClass = 'bg-slate-100 text-slate-500';
  
  if (status === '확정') {
    borderClass = 'border-blue-400 ring-2 ring-blue-200';
    labelClass = 'bg-blue-100 text-blue-700';
  } else if (status === 'SOS') {
    borderClass = 'border-red-400 ring-2 ring-red-200';
    labelClass = 'bg-red-100 text-red-700 animate-pulse';
  }

  return (
    <div className="relative mt-5">
      {/* 상단 탭 영역 (제목 + 상태 라벨) */}
      <div className="flex justify-between items-end mb-0 z-[1] relative">
        <button 
          onClick={() => onComplete(schedule.id, schedule.title)}
          className={`px-4 py-1.5 rounded-t-lg font-bold text-sm shadow-sm flex items-center gap-2 transition-transform active:scale-95 ${schedule.tabTheme}`}
        >
          {schedule.title}
        </button>
        
        <div className={`px-2.5 py-1 rounded-t-md text-xs font-bold ${labelClass} flex items-center gap-1 shadow-sm`}>
          {status === 'SOS' && <AlertTriangle size={14} />}
          {status}
        </div>
      </div>
      
      {/* 드롭 영역 */}
      <div 
        ref={setNodeRef}
        className={`bg-white rounded-b-xl rounded-tl-none rounded-tr-xl p-4 shadow-sm border ${borderClass} ${isOver ? 'bg-blue-50/50' : ''} min-h-[6rem] flex flex-wrap gap-2.5 items-start transition-all relative`}
      >
        {members.length === 0 && (
          <span className="text-slate-400 text-sm font-medium m-auto pointer-events-none">대기 중인 인원이 없습니다</span>
        )}
        
        {members.map(member => (
          <DraggableMember key={member.id} member={member} inSchedule={true} />
        ))}

        {/* 강제 확정 버튼 (대기 상태이면서 인원이 1명이라도 있을 때 활성화) */}
        {status === '대기' && members.length > 0 && (
          <button
            onClick={() => onForceConfirm(schedule.id)}
            className="absolute bottom-2.5 right-2.5 p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 active:scale-95 border border-blue-200 transition-all flex items-center justify-center shadow-sm"
            title="강제 확정"
          >
            <Check size={16} strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
}