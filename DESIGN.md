# TransferWith - 디자인 시스템 및 UI 가이드

## 1. 핵심 컨셉 (Concept)
* **공용 화이트보드 (Shared Whiteboard):** 누구나 직관적으로 볼 수 있고, 로그인/권한 구분 없이 조작 가능한 현장 친화적 UI.
* **서류 폴더형 스케줄 (Folder Index):** 스케줄 카드의 좌측 상단에 인덱스 탭(제목)이 돌출된 형태.
* **드래그 앤 드롭 (Drag & Drop):** 하단 대기열(Pool)과 스케줄 박스 간의 자유로운 인원 이동. '운전자(키)' 속성 또한 이동 가능하게 설계.
* **모바일 최적화 (Mobile-First):** 스마트폰 화면에 맞춘 콤팩트한 패딩, 터치하기 좋은 탭 영역 및 하단 고정 UI.

---

## 2. 레이아웃 구조 (Layout)

### A. 상단 탭 (Top Navigation)
* 화면 최상단에 고정 (`sticky top-0`, `z-20`).
* **Working Day** / **Weekend** 두 가지 탭이 화면을 50:50으로 양분.
* 탭 선택에 따라 메인 앱의 배경색 테마가 동적으로 변경됨.

### B. 메인 대시보드 (Main Content)
* 스케줄 카드가 위에서 아래로 쌓이는 수직형(Column) 구조.
* 우측 상단에 `ADD SCHEDULE` 버튼 배치.

### C. 하단 대기열 (Bottom Pool)
* 화면 하단에 항상 고정 (`fixed bottom-0`, `z-20`).
* 스케줄에 배정되지 않은 전체 인원의 네임택이 모여있는 공간.
* 인원이 많아질 경우 내부에서 세로 스크롤 가능하게 처리 (`max-h-28 overflow-y-auto`).

---

## 3. 컬러 팔레트 (Color Palette - Tailwind CSS)

### 배경 테마 (Background)
* **Working Day (주중):** `bg-amber-50` (연한 크림/노란색 계열)
* **Weekend (주말):** `bg-blue-50/60` (연한 파란색 계열)

### 스케줄 카드 (Schedule Cards)
* 구분하기 쉽도록 파스텔 톤 테마 적용 (추가 시 랜덤 혹은 지정 선택 구현).
* **테마 A (Cyan):** 배경 `bg-cyan-50`, 탭 `bg-cyan-100 text-cyan-800`
* **테마 B (Fuchsia):** 배경 `bg-fuchsia-50`, 탭 `bg-fuchsia-100 text-fuchsia-800`
* 공통: `border border-black/5`, `shadow-sm`

### 네임택 (Name Tags)
* **기본 인원:** `bg-white`, `border-slate-200`, `text-slate-700`
* **스케줄 배정 완료 인원:** `border-emerald-200`, `text-emerald-800` (완료 느낌 부여)
* **키(운전자) 뱃지:** `bg-red-100`, `text-red-600` (작고 눈에 띄게 강조)

---

## 4. UI/UX 상호작용 (Interactions)

* **스케줄 완료 처리:** 
  * 스케줄 카드의 '인덱스 탭(제목)'을 클릭하면 트리거.
  * "완료하시겠습니까?" 컨펌 창 출력.
  * 확인(OK) 시, 해당 스케줄에 속한 인원 네임택 전체가 즉시 **하단 대기열로 자동 복귀**.
* **버튼 및 네임택 클릭/터치 시 피드백:** 
  * `hover:-translate-y-0.5`, `active:scale-95` 적용으로 눌리는 느낌(Tapping) 구현.

---

## 5. 추후 구현 예정 사항 (To-Do)
1. **Drag & Drop 로직:** `dnd-kit`을 활용한 네임택 드래그 이동 기능 구현.
2. **키(운전자) 변경 로직:** 동일 스케줄 내에서 키 뱃지를 다른 네임택으로 넘겨주는 기능 구현.
3. **Firebase 연동:** 실시간 Firestore DB와 연동하여 변경 상태(드래그, 완료, 스케줄 추가) 동기화.