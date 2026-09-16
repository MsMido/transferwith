import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Check, History } from 'lucide-react';
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
  { id: 11, name: '김경훈', keyCount: 0 },
  { id: 12, name: '외부1', keyCount: 0 },
  { id: 13, name: '외부2', keyCount: 0 },
];

const INITIAL_SCHEDULES = [];
const TOTAL_KEYS_FIXED = 4; // 전체 시스템 고정 총 열쇠 개수

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('transferWith_activeTab') || 'Working Day';
  });

  const [myUserNo, setMyUserNo] = useState(() => {
    let savedNo = localStorage.getItem('transferWith_userNo');
    if (!savedNo) {
      savedNo = Math.floor(1000 + Math.random() * 9000).toString();
      localStorage.setItem('transferWith_userNo', savedNo);
    }
    return savedNo;
  });

  const [waitingPool, setWaitingPool] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [individualMembers, setIndividualMembers] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  
  const [selectedMember, setSelectedMember] = useState(null);
  const [keySenderMember, setKeySenderMember] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isMyInfoModalOpen, setIsMyInfoModalOpen] = useState(false);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');

  // 10번 탭 감지용 상태 및 레퍼런스
  const [poolTapCount, setPoolTapCount] = useState(0);
  const poolTapTimerRef = useRef(null);

  const lastTapRef = useRef({ id: null, time: 0 });

  // 탭이 바뀔 때마다 로컬 스토리지 저장 및 선택 상태 강제 초기화 (키 꼬임 방지)
  useEffect(() => {
    localStorage.setItem('transferWith_activeTab', activeTab);
    setSelectedMember(null);
    setKeySenderMember(null);
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
        setSystemLogs(data.systemLogs || []);
      } else {
        setDoc(stateDocRef, {
          waitingPool: INITIAL_POOL,
          schedules: INITIAL_SCHEDULES,
          individualMembers: [],
          systemLogs: [{ text: `${activeTab} 시스템이 초기화되었습니다.`, time: new Date().toLocaleTimeString(), userNo: 'System' }]
        });
      }
    });

    return () => unsubscribe();
  }, [activeTab]);

  const validateAndCalculateKeys = (pool, ind, scheds) => {
    let totalKeys = 0;
    const countPool = (arr) => arr.forEach(m => totalKeys += (m.keyCount || 0));

    countPool(pool);
    countPool(ind);
    scheds.forEach(s => countPool(s.members || []));

    if (totalKeys !== TOTAL_KEYS_FIXED) {
      console.warn(`[무결성 경고] 열쇠 개수가 일치하지 않습니다! 현재 총 개수: ${totalKeys} (기대값: ${TOTAL_KEYS_FIXED})`);
      return false;
    }
    return true;
  };

  const commitStateToFirebase = (newPool, newSchedules, newIndividual, logDescription) => {
    if (!validateAndCalculateKeys(newPool, newIndividual, newSchedules)) {
      alert('오류: 열쇠의 총 개수가 변조되었습니다! 작업이 취소됩니다.');
      return;
    }

    const newLogEntry = {
      text: `[${activeTab}] ${logDescription}`,
      time: new Date().toLocaleTimeString(),
      userNo: myUserNo
    };

    const updatedLogs = [newLogEntry, ...systemLogs].slice(0, 100);

    setDoc(getStateDocRef(), { 
      waitingPool: newPool, 
      schedules: newSchedules, 
      individualMembers: newIndividual,
      systemLogs: updatedLogs
    }, { merge: true });

    setSelectedManagerAndReset();
  };

  const handleMoveMemberTo = (targetAreaType, targetScheduleId = null) => {
    if (!selectedMember) return;
    const memberData = selectedMember;

    let newPool = waitingPool.filter(m => m.id !== memberData.id);
    let newIndividual = individualMembers.filter(m => m.id !== memberData.id);
    let newSchedules = schedules.map(s => ({
      ...s,
      members: s.members.filter(m => m.id !== memberData.id)
    }));

    let targetName = '대기열';
    if (targetAreaType === 'pool') {
      newPool = [...newPool, memberData];
    } else if (targetAreaType === 'individual') {
      newIndividual = [...newIndividual, memberData];
      targetName = '개별 이동';
    } else if (targetAreaType === 'schedule') {
      newSchedules = newSchedules.map(s => {
        if (s.id === targetScheduleId) {
          targetName = s.title;
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

    commitStateToFirebase(newPool, newSchedules, newIndividual, `${memberData.name}님이 [${targetName}] (으)로 이동함`);
  };

  const setSelectedManagerAndReset = () => {
    setSelectedMember(null);
    setKeySenderMember(null);
  };

  const handleTransferKeyTo = (targetMemberId) => {
    if (!keySenderMember) return;
    const sourceId = keySenderMember.id;
    if (sourceId === targetMemberId) return;

    let targetMemberName = '';
    const transferInArray = (arr) => {
      return arr.map(m => {
        if (m.id === targetMemberId) targetMemberName = m.name;
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

    commitStateToFirebase(newPool, newSchedules, newIndividual, `${keySenderMember.name}님이 ${targetMemberName}님에게 키를 전달함`);
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
      
      commitStateToFirebase(newPool, newSchedules, individualMembers, `[${title}] 스케줄 완료 및 해제`);
    }
  };

  const handleResetIndividual = () => {
    if (individualMembers.length === 0) return;
    if (window.confirm('개별 이동 인원을 모두 대기열로 복귀시키겠습니까?')) {
      const newPool = [...waitingPool, ...individualMembers];
      commitStateToFirebase(newPool, schedules, [], '개별 이동 인원 전체 대기열 복귀');
    }
  };

  const handleForceConfirm = (scheduleId, e) => {
    e.stopPropagation();
    const newSchedules = schedules.map(s => 
      s.id === scheduleId ? { ...s, hasBeenConfirmed: true } : s
    );
    const target = schedules.find(s => s.id === scheduleId);
    commitStateToFirebase(waitingPool, newSchedules, individualMembers, `[${target?.title}] 스케줄 강제 확정`);
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
    commitStateToFirebase(waitingPool, newSchedules, individualMembers, `새 스케줄 [${newScheduleTitle}] 생성`);
    
    setNewScheduleTitle('');
    setIsModalOpen(false);
  };

  const renderMemberChip = (member) => {
    const isSelected = selectedMember?.id === member.id;
    const isKeySender = keySenderMember?.id === member.id;
    const isKeyReceiverTarget = keySenderMember && !isKeySender;
    const keys = Array.from({ length: member.keyCount || 0 });

    let borderStyle = 'bg-white/90 border-white/50 text-slate-800 hover:bg-white';
    if (isSelected) {
      borderStyle = 'bg-blue-600 text-white border-blue-500 ring-2 ring-blue-300 scale-105 shadow-md';
    } else if (isKeySender) {
      borderStyle = 'bg-amber-500 text-white border-amber-400 ring-2 ring-amber-300 scale-105 shadow-md';
    } else if (isKeyReceiverTarget) {
      borderStyle = 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300 animate-pulse';
    }

    return (
      <div 
        key={member.id}
        onClick={(e) => handleMemberClick(member, e)}
        className={`flex items-center pl-2.5 pr-1.5 py-1 rounded-lg border shadow-sm cursor-pointer transition-all text-xs font-medium backdrop-blur-sm ${borderStyle}`}
      >
        <span className="py-0.5">{member.name}</span>
        
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
                    : 'bg-amber-100/90 text-amber-800 border-amber-300 hover:bg-amber-200'
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

  return (
    <div className="min-h-screen flex flex-col font-sans select-none relative overflow-x-hidden">
      
      <div className={`fixed inset-0 transition-colors duration-700 ease-in-out z-[-3] ${
        activeTab === 'Working Day' ? 'bg-slate-900' : 'bg-orange-50'
      }`} />

      <div className="fixed inset-0 flex justify-center z-[-2] pointer-events-none">
        <div 
          className="w-full max-w-lg h-full bg-cover bg-center bg-no-repeat transition-all duration-700 ease-in-out opacity-[0.35]"
          style={{ backgroundImage: `url(${activeTab === 'Working Day' ? '/Working.png' : '/Weekend.png'})` }}
        />
      </div>
      
      <div className="fixed inset-0 flex justify-center z-[-1] pointer-events-none">
        <div className={`w-full max-w-lg h-full transition-colors duration-700 ease-in-out ${
          activeTab === 'Working Day' ? 'bg-slate-900/40' : 'bg-white/30'
        }`} />
      </div>

      {selectedMember && (
        <div className="fixed top-12 left-0 right-0 bg-blue-600/95 backdrop-blur-md text-white text-xs font-bold py-1.5 px-3 text-center z-30 shadow-md flex justify-center items-center gap-2 animate-bounce">
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
        <div className="fixed top-12 left-0 right-0 bg-amber-500/95 backdrop-blur-md text-white text-xs font-bold py-1.5 px-3 text-center z-30 shadow-md flex justify-center items-center gap-2 animate-bounce">
          <span>🔑 [{keySenderMember.name}]의 키를 받을 사람을 터치하세요!</span>
          <button 
            onClick={setSelectedManagerAndReset}
            className="bg-amber-600 px-2 py-0.5 rounded text-[10px] hover:bg-amber-700"
          >
            취소
          </button>
        </div>
      )}

      <div className="w-full flex h-13 bg-white/40 backdrop-blur-lg shadow-sm sticky top-0 z-20 border-b border-white/30 transition-colors duration-500">
        <button 
          onClick={() => setActiveTab('Working Day')}
          className={`w-1/2 flex items-center justify-center font-bold text-sm transition-all gap-1.5 ${
            activeTab === 'Working Day' 
              ? 'bg-slate-900/80 text-white shadow-inner' 
              : 'text-slate-700 hover:bg-white/40'
          }`}>
          🏢 Working Day
        </button>
        <button 
          onClick={() => setActiveTab('Weekend')}
          className={`w-1/2 flex items-center justify-center font-bold text-sm transition-all gap-1.5 ${
            activeTab === 'Weekend' 
              ? 'bg-orange-500/80 text-white shadow-inner' 
              : 'text-slate-700 hover:bg-white/40'
          }`}>
          🌴 Weekend
        </button>
        
        <div className="absolute right-3 top-2.5 z-30">
          <button 
            onClick={() => setIsLogModalOpen(true)}
            className="p-1.5 bg-white/60 backdrop-blur-md text-slate-700 hover:bg-white/90 rounded-lg transition-all relative shadow-sm border border-white/40"
            title="전체 최근 변경 이력"
          >
            <History size={16} />
            {systemLogs.length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-lg mx-auto p-3 flex flex-col gap-4 mb-36 relative z-10">
        
        <div className="flex justify-between items-center gap-3 mt-1">
          <div 
            onClick={() => selectedMember && handleMoveMemberTo('individual')}
            className={`flex-1 bg-white/70 backdrop-blur-md rounded-xl p-2.5 shadow-sm border transition-all ${
              selectedMember ? 'border-blue-400 ring-2 ring-blue-300/50 cursor-pointer bg-blue-50/80' : 'border-white/50'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">개별 이동 / 기타 구역</span>
              {individualMembers.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleResetIndividual(); }}
                  className="text-[10px] font-bold text-slate-600 bg-white/80 hover:bg-white px-1.5 py-0.5 rounded shadow-sm"
                >
                  해제
                </button>
              )}
            </div>
            <div className="min-h-[2.5rem] rounded-lg border border-dashed border-slate-400/50 p-1.5 flex flex-wrap gap-1.5 items-center bg-white/30">
              {individualMembers.length === 0 && (
                <span className="text-slate-600 text-[11px] m-auto font-medium">
                  {selectedMember ? '여기를 눌러서 이동' : '개별 이동 인원 없음'}
                </span>
              )}
              {individualMembers.map(m => renderMemberChip(m))}
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 bg-white/80 backdrop-blur-md text-slate-800 px-3 py-2 rounded-xl font-bold text-xs shadow-sm border border-white/50 hover:bg-white active:scale-95 transition-all h-fit self-start"
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

            let borderClass = 'border-white/50';
            let labelClass = 'bg-white/80 text-slate-700';
            if (status === '확정') {
              borderClass = 'border-blue-400/80 ring-2 ring-blue-300/50';
              labelClass = 'bg-blue-100 text-blue-700';
            } else if (status === 'SOS') {
              borderClass = 'border-red-400/80 ring-2 ring-red-300/50';
              labelClass = 'bg-red-100 text-red-700 animate-pulse';
            }

            return (
              <div key={schedule.id} className="relative mt-2">
                <div className="flex justify-between items-end mb-0 z-[1] relative">
                  <button 
                    onClick={() => handleCompleteSchedule(schedule.id, schedule.title)}
                    className={`px-3 py-1 rounded-t-lg font-bold text-xs shadow-sm flex items-center gap-1.5 ${schedule.tabTheme} bg-opacity-90 backdrop-blur-sm`}
                  >
                    {schedule.title}
                  </button>
                  <div className={`px-2 py-0.5 rounded-t-md text-[11px] font-bold ${labelClass} shadow-sm backdrop-blur-sm`}>
                    {status}
                  </div>
                </div>
                
                <div 
                  onClick={() => selectedMember && handleMoveMemberTo('schedule', schedule.id)}
                  className={`bg-white/70 backdrop-blur-md rounded-b-xl rounded-tl-none rounded-tr-xl p-3 shadow-sm border ${borderClass} ${
                    selectedMember ? 'border-blue-400 ring-2 ring-blue-300/50 cursor-pointer bg-blue-50/80' : ''
                  } min-h-[5rem] flex flex-wrap gap-2 items-start transition-all relative`}
                >
                  {members.length === 0 && (
                    <span className="text-slate-600 text-xs font-medium m-auto drop-shadow-sm">
                      {selectedMember ? '여기를 눌러서 합류' : '대기 중인 인원이 없습니다'}
                    </span>
                  )}
                  
                  {members.map(m => renderMemberChip(m))}

                  {status === '대기' && members.length > 0 && (
                    <button
                      onClick={(e) => handleForceConfirm(schedule.id, e)}
                      className="absolute bottom-2 right-2 p-1 bg-white/90 text-blue-600 rounded-md hover:bg-white border border-blue-200 shadow-sm"
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
        onClick={() => {
          if (selectedMember) {
            handleMoveMemberTo('pool');
            return;
          }

          setPoolTapCount(prev => {
            const nextCount = prev + 1;
            if (poolTapTimerRef.current) clearTimeout(poolTapTimerRef.current);
            poolTapTimerRef.current = setTimeout(() => {
              setPoolTapCount(0);
            }, 2000);

            if (nextCount >= 10) {
              setIsMyInfoModalOpen(true);
              return 0;
            }
            return nextCount;
          });
        }}
        className={`fixed bottom-0 left-0 right-0 bg-white/60 backdrop-blur-xl border-t border-white/40 p-3 shadow-lg z-10 transition-all cursor-pointer ${
          selectedMember ? 'border-blue-400 ring-4 ring-blue-300/50 bg-blue-50/80' : ''
        }`}
      >
        <div className="max-w-lg mx-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider drop-shadow-sm">
              {selectedMember ? '👉 여기를 눌러서 대기열로 복귀' : '대기 멤버 풀'}
            </span>
            <span className="text-[11px] font-bold text-slate-800 drop-shadow-sm">{waitingPool.length}명 대기중</span>
          </div>

          <div className="min-h-[3.5rem] max-h-32 overflow-y-auto rounded-xl border border-dashed border-slate-500/40 p-2 flex flex-wrap gap-1.5 items-start bg-white/40">
            {waitingPool.length === 0 && (
              <span className="text-slate-600 text-[11px] m-auto font-medium">대기 중인 인원이 없습니다.</span>
            )}
            {waitingPool.map(m => renderMemberChip(m))}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl w-full max-w-sm p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-slate-800">새 스케줄 생성</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-800">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddSchedule} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">이동 경로</label>
                <input
                  type="text"
                  value={newScheduleTitle}
                  onChange={(e) => setNewScheduleTitle(e.target.value)}
                  placeholder="예: 공장 > HEB 마트 > 숙소"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80"
                  autoFocus
                />
              </div>
              <button 
                type="submit"
                disabled={!newScheduleTitle.trim()}
                className="w-full bg-slate-800/90 backdrop-blur-sm text-white font-bold py-2 rounded-lg text-xs mt-1 disabled:bg-slate-400"
              >
                등록하기
              </button>
            </form>
          </div>
        </div>
      )}

      {isLogModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl w-full max-w-md p-4 shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-3 pb-2 border-b">
              <h2 className="text-sm font-bold text-slate-800">📋 전체 최근 변경 이력 (최대 100개)</h2>
              <button onClick={() => setIsLogModalOpen(false)} className="text-slate-500 hover:text-slate-800">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
              {systemLogs.length === 0 && (
                <span className="text-xs text-slate-400 text-center py-6">기록된 이력이 없습니다.</span>
              )}
              {systemLogs.map((log, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 text-xs flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                    <span>사용자 ID: #{log.userNo}</span>
                    <span>{log.time}</span>
                  </div>
                  <div className="text-slate-700 font-medium">{log.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isMyInfoModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl w-full max-w-xs p-5 shadow-xl flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl mb-1 shadow-inner">
              🔑
            </div>
            <h2 className="text-base font-bold text-slate-800">내 시스템 사용자 번호</h2>
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 w-full">
              <span className="text-xl font-black text-blue-600 tracking-widest">#{myUserNo}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              이 번호는 브라우저에 자동 저장되어 시스템 변경 이력에 기록됩니다.
            </p>
            <button 
              onClick={() => setIsMyInfoModalOpen(false)}
              className="w-full bg-slate-800 text-white font-bold py-2 rounded-xl text-xs mt-2"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;