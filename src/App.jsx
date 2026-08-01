import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Check } from 'lucide-react';
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
  { id: 11, name: '우용', keyCount: 0 },
];

const INITIAL_SCHEDULES = [];

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('transferWith_activeTab') || 'Working Day';
  });

  const [waitingPool, setWaitingPool] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [individualMembers, setIndividualMembers] = useState([]);
  
  const [selectedMember, setSelectedMember] = useState(null);
  const [keySenderMember, setKeySenderMember] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');

  const lastTapRef = useRef({ id: null, time: 0 });

  useEffect(() => {
    localStorage.setItem('transferWith_activeTab', activeTab);
  }, [activeTab]);

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

  const handleMoveMemberTo = (targetAreaType, targetScheduleId = null) => {
    if (!selectedMember) return;
    const memberData = selectedMember;

    let newPool = waitingPool.filter(m => m.id !== memberData.id);
    let newIndividual = individualMembers.filter(m => m.id !== memberData.id);
    let newSchedules = schedules.map(s => ({
      ...s,
      members: s.members.filter(m => m.id !== memberData.id)
    }));

    if (targetAreaType === 'pool') {
      newPool = [...newPool, memberData];
    } else if (targetAreaType === 'individual') {
      newIndividual = [...newIndividual, memberData];
    } else if (targetAreaType === 'schedule') {
      newSchedules = newSchedules.map(s => {
        if (s.id === targetScheduleId) {
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

    setSelectedManagerAndReset();
  };

  const setSelectedManagerAndReset = () => {
    setSelectedMember(null);
    setKeySenderMember(null);
  };

  const handleTransferKeyTo = (targetMemberId) => {
    if (!keySenderMember) return;
    const sourceId = keySenderMember.id;
    if (sourceId === targetMemberId) return;

    const transferInArray = (arr) => {
      const hasSource = arr.some(m => m.id === sourceId);
      const hasTarget = arr.some(m => m.id === targetMemberId);
      if (!hasSource && !hasTarget) return arr;

      return arr.map(m => {
        if (m.id === sourceId) {
          return { ...m, keyCount: Math.max(0, (m.keyCount || 0) - 1) };
        }
        if (m.id === targetMemberId) {
          return { ...m, keyCount: (m.keyCount || 0) + 1 };
        }
        return m;
      });
    };

    const newPool = transferInArray(waitingPool);
    const newIndividual = transferInArray(individualMembers);
    const newSchedules = schedules.map(s => ({
      ...s,
      members: transferInArray(s.members)
    }));

    setDoc(getStateDocRef(), { 
      waitingPool: newPool, 
      schedules: newSchedules, 
      individualMembers: newIndividual 
    }, { merge: true });

    setSelectedManagerAndReset();
  };

  const handleMemberClick = (member, e) => {
    e.stopPropagation();

    const now = Date.now();
    const isDoubleTap = lastTapRef.current.id === member.id && (now - lastTapRef.current.time < 300);
    lastTapRef.current = { id: member.id, time: now };

    if (isDoubleTap && (member.keyCount || 0) > 0) {
      setKeySenderMember(keySenderMember?.id === member.id ? null : member);
      setSelectedMember(null);
      return;
    }

    if (keySenderMember) {
      if (keySenderMember.id === member.id) {
        setKeySenderMember(null);
      } else {
        handleTransferKeyTo(member.id);
      }
      return;
    }

    if (selectedMember?.id === member.id) {
      setSelectedMember(null);
    } else {
      setSelectedMember(member);
      setKeySenderMember(null);
    }
  };

  const handleKeyBadgeClick = (member, e) => {
    e.stopPropagation();
    if ((member.keyCount || 0) <= 0) return;

    if (keySenderMember?.id === member.id) {
      setKeySenderMember(null);
    } else {
      setKeySenderMember(member);
      setSelectedMember(null);
    }
  };

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

  const handleResetIndividual = () => {
    if (individualMembers.length === 0) return;
    if (window.confirm('개별 이동 인원을 모두 대기열로 복귀시키겠습니까?')) {
      const newPool = [...waitingPool, ...individualMembers];
      setDoc(getStateDocRef(), { waitingPool: newPool, schedules, individualMembers: [] }, { merge: true });
    }
  };

  const handleForceConfirm = (scheduleId, e) => {
    e.stopPropagation();
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

  const renderMemberChip = (member) => {
    const isSelected = selectedMember?.id === member.id;
    const isKeySender = keySenderMember?.id === member.id;
    const isKeyReceiverTarget = keySenderMember && !isKeySender;
    const keys = Array.from({ length: member.keyCount || 0 });

    let borderStyle = 'bg-white border-slate-200 text-slate-700 hover:border-slate-300';
    if (isSelected) {
      borderStyle = 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300 scale-105';
    } else if (isKeySender) {
      borderStyle = 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 scale-105';
    } else if (isKeyReceiverTarget) {
      borderStyle = 'bg-amber-50 border-amber-400 ring-2 ring-amber-200 animate-pulse';
    }

    return (
      <div 
        key={member.id}
        onClick={(e) => handleMemberClick(member, e)}
        className={`flex items-center pl-2.5 pr-1.5 py-1 rounded-lg border shadow-sm cursor-pointer transition-all text-xs ${borderStyle}`}
      >
        <span className="font-bold py-0.5">{member.name}</span>
        
        <div className="flex gap-0.5 ml-1.5 items-center">
          {keys.map((_, idx) => (
            <span 
              key={idx} 
              onClick={(e) => handleKeyBadgeClick(member, e)}
              className={`px-1 py-0.5 rounded text-[10px] shadow-sm border transition-transform cursor-pointer ${
                isKeySender 
                  ? 'bg-amber-600 text-white border-amber-400 scale-110' 
                  : isSelected 
                    ? 'bg-blue-500 text-white border-blue-400' 
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="키를 누르거나 더블클릭하면 키 넘기기 모드가 켜집니다"
            >
              🔑
            </span>
          ))}
        </div>
      </div>
    );
  };

  const mainBgColor = activeTab === 'Working Day' ? 'bg-slate-50' : 'bg-blue-50/60';

  return (
    <div className={`min-h-screen ${mainBgColor} flex flex-col font-sans transition-colors duration-300 select-none relative overflow-x-hidden`}>
      
      {/* 🌟 연한 격자 배경 및 우측 하단 은은한 자동차 실루엣 워터마크 */}
      <div className="absolute inset-0 opacity-[0.35] pointer-events-none bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="absolute right-[-30px] bottom-16 opacity-[0.03] pointer-events-none select-none z-0">
        <svg width="320" height="320" viewBox="0 0 24 24" fill="currentColor" className="text-slate-900">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.76l.12.34V17z"/>
          <circle cx="7.5" cy="14.5" r="1.5"/>
          <circle cx="16.5" cy="14.5" r="1.5"/>
        </svg>
      </div>

      {selectedMember && (
        <div className="fixed top-12 left-0 right-0 bg-blue-600 text-white text-xs font-bold py-1.5 px-3 text-center z-30 shadow-md flex justify-center items-center gap-2 animate-bounce">
          <span>🎯 [{selectedMember.name}] 이동할 장소를 터치하세요!</span>
          <button 
            onClick={setSelectedManagerAndReset}
            className="bg-blue-700 px-2 py-0.5 rounded text-[10px] hover:bg-blue-800"
          >
            취소
          </button>
        </div>
      )}

      {keySenderMember && (
        <div className="fixed top-12 left-0 right-0 bg-amber-500 text-white text-xs font-bold py-1.5 px-3 text-center z-30 shadow-md flex justify-center items-center gap-2 animate-bounce">
          <span>🔑 [{keySenderMember.name}]의 키를 받을 사람을 터치하세요!</span>
          <button 
            onClick={setSelectedManagerAndReset}
            className="bg-amber-600 px-2 py-0.5 rounded text-[10px] hover:bg-amber-700"
          >
            취소
          </button>
        </div>
      )}

      <div className="w-full flex h-13 bg-white/70 backdrop-blur-md shadow-sm sticky top-0 z-20 border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('Working Day')}
          className={`w-1/2 flex items-center justify-center font-bold text-sm transition-all gap-1.5 ${
            activeTab === 'Working Day' 
              ? 'bg-slate-900 text-white shadow-inner' 
              : 'text-slate-400 hover:bg-slate-100/50 hover:text-slate-600'
          }`}>
          🏢 Working Day
        </button>
        <button 
          onClick={() => setActiveTab('Weekend')}
          className={`w-1/2 flex items-center justify-center font-bold text-sm transition-all gap-1.5 ${
            activeTab === 'Weekend' 
              ? 'bg-blue-600 text-white shadow-inner' 
              : 'text-slate-400 hover:bg-blue-50/50 hover:text-slate-600'
          }`}>
          🌴 Weekend
        </button>
      </div>

      <main className="flex-1 w-full max-w-lg mx-auto p-3 flex flex-col gap-4 mb-36 relative z-10">
        
        <div className="flex justify-between items-center gap-3 mt-1">
          <div 
            onClick={() => selectedMember && handleMoveMemberTo('individual')}
            className={`flex-1 bg-white/90 backdrop-blur-sm rounded-xl p-2.5 shadow-sm border transition-all ${
              selectedMember ? 'border-blue-400 ring-2 ring-blue-100 cursor-pointer bg-blue-50/30' : 'border-slate-200'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">개별 이동 / 기타 구역</span>
              {individualMembers.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleResetIndividual(); }}
                  className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded"
                >
                  해제
                </button>
              )}
            </div>
            <div className="min-h-[2.5rem] rounded-lg border border-dashed border-slate-200 p-1.5 flex flex-wrap gap-1.5 items-center bg-slate-50/50">
              {individualMembers.length === 0 && (
                <span className="text-slate-400 text-[11px] m-auto">
                  {selectedMember ? '여기를 눌러서 이동' : '개별 이동 인원 없음'}
                </span>
              )}
              {individualMembers.map(m => renderMemberChip(m))}
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 bg-white/90 backdrop-blur-sm text-slate-700 px-3 py-2 rounded-xl font-bold text-xs shadow-sm border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all h-fit self-start"
          >
            <Plus size={14} />
            스케줄 등록
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {schedules.map((schedule) => {
            const members = schedule.members || [];
            const keyCount = members.reduce((sum, m) => sum + (m.keyCount || 0), 0);
            
            let status = '대기';
            if (schedule.hasBeenConfirmed || members.length >= 3) {
              status = keyCount === 0 ? 'SOS' : '확정';
            }

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
              <div key={schedule.id} className="relative mt-2">
                <div className="flex justify-between items-end mb-0 z-[1] relative">
                  <button 
                    onClick={() => handleCompleteSchedule(schedule.id, schedule.title)}
                    className={`px-3 py-1 rounded-t-lg font-bold text-xs shadow-sm flex items-center gap-1.5 ${schedule.tabTheme}`}
                  >
                    {schedule.title}
                  </button>
                  <div className={`px-2 py-0.5 rounded-t-md text-[11px] font-bold ${labelClass} shadow-sm`}>
                    {status}
                  </div>
                </div>
                
                <div 
                  onClick={() => selectedMember && handleMoveMemberTo('schedule', schedule.id)}
                  className={`bg-white/90 backdrop-blur-sm rounded-b-xl rounded-tl-none rounded-tr-xl p-3 shadow-sm border ${borderClass} ${
                    selectedMember ? 'border-blue-400 ring-2 ring-blue-100 cursor-pointer bg-blue-50/20' : ''
                  } min-h-[5rem] flex flex-wrap gap-2 items-start transition-all relative`}
                >
                  {members.length === 0 && (
                    <span className="text-slate-400 text-xs font-medium m-auto">
                      {selectedMember ? '여기를 눌러서 합류' : '대기 중인 인원이 없습니다'}
                    </span>
                  )}
                  
                  {members.map(m => renderMemberChip(m))}

                  {status === '대기' && members.length > 0 && (
                    <button
                      onClick={(e) => handleForceConfirm(schedule.id, e)}
                      className="absolute bottom-2 right-2 p-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 border border-blue-200 shadow-sm"
                      title="강제 확정"
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div 
        onClick={() => selectedMember && handleMoveMemberTo('pool')}
        className={`fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t p-3 shadow-lg z-10 transition-all ${
          selectedMember ? 'border-blue-400 ring-4 ring-blue-200 bg-blue-50/90 cursor-pointer' : 'border-slate-200'
        }`}
      >
        <div className="max-w-lg mx-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {selectedMember ? '👉 여기를 눌러서 대기열로 복귀' : '대기 멤버 풀'}
            </span>
            <span className="text-[11px] font-bold text-slate-500">{waitingPool.length}명 대기중</span>
          </div>

          <div className="min-h-[3.5rem] max-h-32 overflow-y-auto rounded-xl border border-dashed border-slate-200 p-2 flex flex-wrap gap-1.5 items-start bg-slate-50/50">
            {waitingPool.length === 0 && (
              <span className="text-slate-400 text-[11px] m-auto">대기 중인 인원이 없습니다.</span>
            )}
            {waitingPool.map(m => renderMemberChip(m))}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-slate-800">새 스케줄 생성</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddSchedule} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">이동 경로</label>
                <input
                  type="text"
                  value={newScheduleTitle}
                  onChange={(e) => setNewScheduleTitle(e.target.value)}
                  placeholder="예: 공장 > HEB 마트 > 숙소"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <button 
                type="submit"
                disabled={!newScheduleTitle.trim()}
                className="w-full bg-slate-800 text-white font-bold py-2 rounded-lg text-xs mt-1 disabled:bg-slate-300"
              >
                등록하기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;