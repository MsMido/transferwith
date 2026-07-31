import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import DraggableMember from './DraggableMember';

export default function WaitingPool({ members }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'pool',
  });

  return (
    <footer className="bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 fixed bottom-0 w-full z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] pb-safe">
      <div className="max-w-lg mx-auto">
        <h3 className="text-xs font-bold text-slate-400 mb-3">대기 인원 명단</h3>
        
        <div 
          ref={setNodeRef}
          className={`flex flex-wrap gap-2.5 min-h-[4rem] max-h-28 overflow-y-auto content-start p-2 -m-2 rounded-lg transition-all ${isOver ? 'bg-slate-50 ring-2 ring-blue-100' : ''}`}
        >
          {members.length === 0 && (
            <span className="text-slate-400 text-sm m-auto pointer-events-none">대기열이 비어있습니다.</span>
          )}
          {members.map(member => (
            <DraggableMember key={member.id} member={member} inSchedule={false} />
          ))}
        </div>
      </div>
    </footer>
  );
}