import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { UserMinus } from 'lucide-react';
import DraggableMember from './DraggableMember';

export default function IndividualArea({ members, onReset }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'individual-area',
    data: { type: 'individual-area' }
  });

  return (
    <div className="w-full bg-white rounded-xl p-3 shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">개별 이동 / 기타 구역</span>
        {members.length > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-all active:scale-95"
            title="배치된 인원 전원 대기열 복귀"
          >
            <UserMinus size={12} />
            해제
          </button>
        )}
      </div>

      <div 
        ref={setNodeRef}
        className={`min-h-[3rem] rounded-lg border border-dashed border-slate-200 p-2 flex flex-wrap gap-2 items-center transition-all ${isOver ? 'bg-slate-50 border-blue-300' : 'bg-slate-50/50'}`}
      >
        {members.length === 0 && (
          <span className="text-slate-400 text-xs m-auto pointer-events-none">개별 이동 인원을 여기에 놓으세요</span>
        )}

        {members.map(member => (
          <DraggableMember key={member.id} member={member} inSchedule={true} />
        ))}
      </div>
    </div>
  );
}