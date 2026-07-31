import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function DraggableKey({ ownerId, keyIndex }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `key-${ownerId}-${keyIndex}`,
    data: { type: 'key', ownerId }
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 'auto',
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="ml-1 bg-amber-50/80 px-1 py-0.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-amber-100 shadow-sm border border-amber-200 touch-none flex-shrink-0 flex items-center justify-center text-xs"
      title="차키"
    >
      🔑
    </div>
  );
}

export default function DraggableMember({ member, inSchedule }) {
  const { 
    attributes: mAttr, listeners: mList, setNodeRef: setDragRef, 
    transform: mTrans, isDragging: mDrag 
  } = useDraggable({
    id: `member-${member.id}`,
    data: { type: 'member', member }
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `member-drop-${member.id}`,
    data: { type: 'member-drop', memberId: member.id }
  });

  const mStyle = mTrans ? {
    transform: CSS.Translate.toString(mTrans),
    zIndex: mDrag ? 50 : 'auto',
    opacity: mDrag ? 0.8 : 1,
  } : undefined;

  const baseClass = inSchedule
    ? "bg-white border border-emerald-200 text-emerald-800"
    : "bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600";
  
  const overClass = isOver ? "ring-2 ring-red-400 bg-red-50 scale-105" : "";

  const keys = Array.from({ length: member.keyCount || 0 });

  return (
    <div 
      ref={setDropRef}
      style={mStyle}
      className={`flex items-center pl-3 pr-1 py-1 rounded-lg border shadow-sm transition-all ${baseClass} ${overClass}`}
    >
      <div 
        ref={setDragRef} 
        {...mList} 
        {...mAttr}
        className="font-bold text-sm cursor-grab active:cursor-grabbing flex-1 py-0.5 touch-none"
      >
        {member.name}
      </div>
      
      <div className="flex gap-0.5">
        {keys.map((_, idx) => (
          <DraggableKey key={idx} ownerId={member.id} keyIndex={idx} />
        ))}
      </div>
    </div>
  );
}