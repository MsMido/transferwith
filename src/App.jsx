import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { DndContext, pointerWithin } from '@dnd-kit/core';
import DroppableSchedule from './components/DroppableSchedule';
import WaitingPool from './components/WaitingPool';
import IndividualArea from './components/IndividualArea';
import { db } from './firebase/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const INITIAL_POOL = [
  { id: 1, name: '김명수', keyCount: 0 },
  { id: 2, name: '류혜미', keyCount: 0 },
  { id: 3, name: '김만수', keyCount: 1 },
  { id: 4, name: '이구연', keyCount: 0 },
  { id: 5, name: '한승우', keyCount: 0 },
  { id: 6, name: '강천주', keyCount: 1 },
  { id: 7, name: '권재호', keyCount: 0 },
  { id: 8, name: '김진영', keyCount: 0 },
  { id: 9, name: '황정민', keyCount: 1 },
  { id: 10, name: '황종철', keyCount: 1 },
];

const INITIAL_SCHEDULES = [

];

function App() {
  const [activeTab, setActiveTab] = useState('Working Day');
  const [waitingPool, setWaitingPool] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [individualMembers, setIndividualMembers] = useState([]); // 개별 이동 인원 상태
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');

  const getStateDocRef = () => {
    const docId = activeTab === 'Working Day' ? 'workingDay' : 'weekend';
    return doc(db, 'carpoolState', docId);
  };

  useEffect(() => {
    const stateDocRef = getStateDocRef();
    
    const unsubscribe = onSnapshot(stateDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWaitingPool(data.waitingPool || []);
        setSchedules(data.schedules || []);
        setIndividualMembers(data.individualMembers || []);
      } else {
        setDoc(stateDocRef, {
          waitingPool: INITIAL_POOL,
          schedules: INITIAL_SCHEDULES,
          individualMembers: []
        });
      }
    });

    return () => unsubscribe();
  }, [activeTab]);

  const handleCompleteSchedule = (scheduleId, title) => {
    const targetSchedule = schedules.find(s => s.id === scheduleId);
    if (!targetSchedule) return;

    const confirmMessage = targetSchedule.members.length > 0
      ? `[${title}] 스케줄을 완료 및 해제하시겠습니까?\n배치된 인원은 대기열로 복귀합니다.`
      : `[${title}] 빈 스케줄을 삭제하시겠습니까?`;

    if (window.confirm(confirmMessage)) {
      const newPool = [...waitingPool, ...targetSchedule.members];
      const newSchedules = schedules.filter(s => s.id !== scheduleId);
      
      setDoc(getStateDocRef(), { waitingPool: newPool, schedules: newSchedules, individualMembers }, { merge: true });
    }
  };

  // 개별 이동 구역 인원 전체 대기열 복귀 (해제 버튼)
  const handleResetIndividual = () => {
    if (individualMembers.length === 0) return;
    if (window.confirm('개별 이동 인원을 모두 대기열로 복귀시키겠습니까?')) {
      const newPool = [...waitingPool, ...individualMembers];
      setDoc(getStateDocRef(), { waitingPool: newPool, schedules, individualMembers: [] }, { merge: true });
    }
  };

  const handleForceConfirm = (scheduleId) => {
    const newSchedules = schedules.map(s => 
      s.id === scheduleId ? { ...s, hasBeenConfirmed: true } : s
    );
    setDoc(getStateDocRef(), { waitingPool, schedules: newSchedules, individualMembers }, { merge: true });
  };

  const handleAddSchedule = (e) => {
    e.preventDefault();
    if (!newScheduleTitle.trim()) return;

    const newSchedule = {
      id: `s_${Date.now()}`,
      title: newScheduleTitle,
      theme: 'bg-green-50',
      tabTheme: 'bg-green-100 text-green-800',
      hasBeenConfirmed: false,
      members: []
    };

    const newSchedules = [...schedules, newSchedule];
    setDoc(getStateDocRef(), { waitingPool, schedules: newSchedules, individualMembers }, { merge: true });
    
    setNewScheduleTitle('');
    setIsModalOpen(false);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type; 
    let overId = over.id.toString();

    // 1. 키 이동 로직
    if (activeType === 'key') {
      if (overId.startsWith('member-drop-')) {
        const ownerId = active.data.current.ownerId;
        const targetMemberId = Number(overId.replace('member-drop-', ''));
        
        if (ownerId === targetMemberId) return;

        const transferKey = (membersArray) => membersArray.map(m => {
          let newKeyCount = m.keyCount || 0;
          if (m.id === ownerId) newKeyCount = Math.max(0, newKeyCount - 1);
          if (m.id === targetMemberId) newKeyCount += 1;
          return { ...m, keyCount: newKeyCount };
        });

        const newSchedules = schedules.map(s => ({ ...s, members: transferKey(s.members) }));
        const newPool = transferKey(waitingPool);
        const newIndividual = transferKey(individualMembers);

        setDoc(getStateDocRef(), { waitingPool: newPool, schedules: newSchedules, individualMembers: newIndividual }, { merge: true });
      }
      return; 
    }

    // 2. 멤버 이동 로직
    if (activeType === 'member') {
      const memberData = active.data.current?.member;
      if (!memberData) return;

      if (overId.startsWith('member-drop-')) {
        const targetId = Number(overId.replace('member-drop-', ''));
        const inPool = waitingPool.find(m => m.id === targetId);
        
        if (inPool) {
          overId = 'pool';
        } else {
          const inIndividual = individualMembers.find(m => m.id === targetId);
          if (inIndividual) {
            overId = 'individual-area';
          } else {
            const inSchedule = schedules.find(s => s.members.some(m => m.id === targetId));
            if (inSchedule) overId = `schedule-${inSchedule.id}`;
          }
        }
      }

      // 기존 위치에서 제거
      let newPool = waitingPool.filter(m => m.id !== memberData.id);
      let newIndividual = individualMembers.filter(m => m.id !== memberData.id);
      let newSchedules = schedules.map(s => ({
        ...s,
        members: s.members.filter(m => m.id !== memberData.id)
      }));

      // 새 위치에 추가
      if (overId === 'pool') {
        newPool = [...newPool, memberData];
      } else if (overId === 'individual-area') {
        newIndividual = [...newIndividual, memberData];
      } else if (overId.startsWith('schedule-')) {
        const scheduleId = overId.replace('schedule-', '');
        newSchedules = newSchedules.map(s => {
          if (s.id === scheduleId) {
            const updatedMembers = [...s.members, memberData];
            return { 
              ...s, 
              members: updatedMembers,
              hasBeenConfirmed: s.hasBeenConfirmed || updatedMembers.length >= 3 
            };
          }
          return s;
        });
      }

      setDoc(getStateDocRef(), { 
        waitingPool: newPool, 
        schedules: newSchedules, 
        individualMembers: newIndividual 
      }, { merge: true });
    }
  };

  const mainBgColor = activeTab === 'Working Day' ? 'bg-slate-50' : 'bg-blue-50/60';

  return (
    <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <div className={`min-h-screen ${mainBgColor} flex flex-col font-sans transition-colors duration-300`}>
        
        <div className="w-full flex h-14 bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
          <button 
            onClick={() => setActiveTab('Working Day')}
            className={`w-1/2 flex items-center justify-center font-bold text-base transition-colors ${activeTab === 'Working Day' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
            Working Day
          </button>
          <button 
            onClick={() => setActiveTab('Weekend')}
            className={`w-1/2 flex items-center justify-center font-bold text-base transition-colors ${activeTab === 'Weekend' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-blue-50 hover:text-slate-600'}`}>
            Weekend
          </button>
        </div>

        <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col gap-6 mb-36">
          <div className="flex justify-between items-center mt-2 gap-4">
            {/* 개별 이동 구역 */}
            <div className="flex-1">
              <IndividualArea members={individualMembers} onReset={handleResetIndividual} />
            </div>

            {/* 새 스케줄 등록 버튼 */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 bg-white text-slate-700 px-4 py-2 rounded-xl font-bold text-sm shadow-sm border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all h-fit self-start mt-1"
            >
              <Plus size={16} />
              스케줄 등록
            </button>
          </div>

          <div className="flex flex-col gap-8">
            {schedules.map((schedule) => (
              <DroppableSchedule 
                key={schedule.id} 
                schedule={schedule} 
                onComplete={handleCompleteSchedule} 
                onForceConfirm={handleForceConfirm}
              />
            ))}
          </div>
        </main>

        <WaitingPool members={waitingPool} />

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">새 스케줄 생성</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleAddSchedule} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1.5">이동 경로</label>
                  <input
                    type="text"
                    value={newScheduleTitle}
                    onChange={(e) => setNewScheduleTitle(e.target.value)}
                    placeholder="예: 공장 > HEB 마트 > 숙소"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={!newScheduleTitle.trim()}
                  className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg text-sm mt-2 disabled:bg-slate-300 disabled:cursor-not-allowed active:bg-slate-900 transition-colors"
                >
                  등록하기
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}

export default App;