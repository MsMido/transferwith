import React, { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import IndividualArea from './components/IndividualArea';
import { db } from './firebase/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// ------------------------------------------------------------------
// 🛠️ [수동 코딩 영역] 초기 멤버 및 차키 설정
// ------------------------------------------------------------------
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
  const [individualMembers, setIndividualMembers] = useState([]);
  
  // 탭 투 무브를 위한 현재 선택된 멤버 상태
  const [selectedMember, setSelectedMember] = useState(null);

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

  // 특정 위치로 멤버를 이동시키는 공통 함수
  const handleMoveMemberTo = (targetAreaType, targetScheduleId = null) => {
    if (!selectedMember) return;
    const memberData = selectedMember.member;

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

    setSelectedMember(null); // 이동 후 선택 해제
  };

  // 키 양도 기능
  const handleKeyClick = (ownerId, e) => {
    e.stopPropagation();
    if (!selectedMember || selectedMember.member.id === ownerId) return;

    const targetMemberId = ownerId;
    const sourceMemberId = selectedMember.member.id;

    const transferKey = (membersArray) => membersArray.map(m => {
      let newKeyCount = m.keyCount || 0;
      if (m.id === sourceMemberId) newKeyCount = Math.max(0, newKeyCount - 1);
      if (m.id === targetMemberId) newKeyCount += 1;
      return { ...m, keyCount: newKeyCount };
    });

    const newSchedules = schedules.map(s => ({ ...s, members: transferKey(s.members) }));
    const newPool = transferKey(waitingPool);
    const newIndividual = transferKey(individualMembers);

    setDoc(getStateDocRef(), { waitingPool: newPool, schedules: newSchedules, individualMembers: newIndividual }, { merge: true });
    setSelectedMember(null);
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

  // 렌더링용 멤버 칩 컴포넌트
  const renderMemberChip = (member) => {
    const isSelected = selectedMember?.member.id === member.id;
    const keys = Array.from({ length: member.keyCount || 0 });

    return (
      <div 
        key={member.id}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedMember(isSelected ? null : { member });
        }}
        className={`flex items-center pl-3 pr-1.5 py-1 rounded-xl border shadow-sm cursor-pointer transition-all ${
          isSelected 
            ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300 scale-105' 
            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
        }`}
      >
        <span className="font-bold text-sm py-0.5">{member.name}</span>
        <div className="flex gap-1 ml-2">
          {keys.map((_, idx) => (
            <span 
              key={idx} 
              onClick={(e) => handleKeyClick(member.id, e)}
              className={`px-1 py-0.5 rounded-md text-xs shadow-sm border ${
                isSelected ? 'bg-blue-500 text-white border-blue-400' : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title="키를 누르면 선택된 멤버에게 양도됩니다"
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
    <div className={`min-h-screen ${mainBgColor} flex flex-col font-sans transition-colors duration-300 select-none`}>
      
      {/* 상단 선택 안내 배너 */}
      {selectedMember && (
        <div className="fixed top-14 left-0 right-0 bg-blue-600 text-white text-xs font-bold py-2 px-4 text-center z-30 shadow-md flex justify-center items-center gap-2 animate-bounce">
          <span>🎯 [{selectedMember.member.name}] 이동할 장소(스케줄 또는 대기열)를 터치하세요!</span>
          <button 
            onClick={() => setSelectedMember(null)}
            className="bg-blue-700 px-2 py-0.5 rounded text-[10px] hover:bg-blue-800"
          >
            취소
          </button>
        </div>
      )}

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

      <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col gap-6 mb-44">
        
        {/* 개별 이동 구역 */}
        <div className="flex justify-between items-center mt-2 gap-4">
          <div 
            onClick={() => selectedMember && handleMoveMemberTo('individual')}
            className={`flex-1 bg-white rounded-xl p-3 shadow-sm border transition-all ${
              selectedMember ? 'border-blue-400 ring-2 ring-blue-100 cursor-pointer bg-blue-50/30' : 'border-slate-200'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">개별 이동 / 기타 구역</span>
              {individualMembers.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleResetIndividual(); }}
                  className="text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md"
                >
                  해제
                </button>
              )}
            </div>
            <div className="min-h-[3rem] rounded-lg border border-dashed border-slate-200 p-2 flex flex-wrap gap-2 items-center bg-slate-50/50">
              {individualMembers.length === 0 && (
                <span className="text-slate-400 text-xs m-auto">
                  {selectedMember ? '여기를 눌러서 이동' : '개별 이동 인원 없음'}
                </span>
              )}
              {individualMembers.map(m => renderMemberChip(m))}
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-white text-slate-700 px-4 py-2 rounded-xl font-bold text-sm shadow-sm border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all h-fit self-start mt-1"
          >
            <Plus size={16} />
            스케줄 등록
          </button>
        </div>

        {/* 스케줄 박스 목록 */}
        <div className="flex flex-col gap-8">
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
              <div key={schedule.id} className="relative mt-5">
                <div className="flex justify-between items-end mb-0 z-[1] relative">
                  <button 
                    onClick={() => handleCompleteSchedule(schedule.id, schedule.title)}
                    className={`px-4 py-1.5 rounded-t-lg font-bold text-sm shadow-sm flex items-center gap-2 ${schedule.tabTheme}`}
                  >
                    {schedule.title}
                  </button>
                  <div className={`px-2.5 py-1 rounded-t-md text-xs font-bold ${labelClass} shadow-sm`}>
                    {status}
                  </div>
                </div>
                
                <div 
                  onClick={() => selectedMember && handleMoveMemberTo('schedule', schedule.id)}
                  className={`bg-white rounded-b-xl rounded-tl-none rounded-tr-xl p-4 shadow-sm border ${borderClass} ${
                    selectedMember ? 'border-blue-400 ring-2 ring-blue-100 cursor-pointer bg-blue-50/20' : ''
                  } min-h-[6rem] flex flex-wrap gap-2.5 items-start transition-all relative`}
                >
                  {members.length === 0 && (
                    <span className="text-slate-400 text-sm font-medium m-auto">
                      {selectedMember ? '여기를 눌러서 합류' : '대기 중인 인원이 없습니다'}
                    </span>
                  )}
                  
                  {members.map(m => renderMemberChip(m))}

                  {status === '대기' && members.length > 0 && (
                    <button
                      onClick={(e) => handleForceConfirm(schedule.id, e)}
                      className="absolute bottom-2.5 right-2.5 p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 border border-blue-200 shadow-sm"
                      title="강제 확정"
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 하단 대기 멤버 풀 */}
      <div 
        onClick={() => selectedMember && handleMoveMemberTo('pool')}
        className={`fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t p-4 shadow-lg z-10 transition-all ${
          selectedMember ? 'border-blue-400 ring-4 ring-blue-200 bg-blue-50/90 cursor-pointer' : 'border-slate-200'
        }`}
      >
        <div className="max-w-lg mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {selectedMember ? '👉 여기를 눌러서 대기열로 복귀' : '대기 멤버 풀'}
            </span>
            <span className="text-xs font-bold text-slate-500">{waitingPool.length}명 대기중</span>
          </div>

          <div className="min-h-[4rem] max-h-36 overflow-y-auto rounded-xl border border-dashed border-slate-200 p-2.5 flex flex-wrap gap-2 items-start bg-slate-50/50">
            {waitingPool.length === 0 && (
              <span className="text-slate-400 text-xs m-auto">대기 중인 인원이 없습니다.</span>
            )}
            {waitingPool.map(m => renderMemberChip(m))}
          </div>
        </div>
      </div>

      {/* 새 스케줄 생성 모달 */}
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
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <button 
                type="submit"
                disabled={!newScheduleTitle.trim()}
                className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg text-sm mt-2 disabled:bg-slate-300"
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