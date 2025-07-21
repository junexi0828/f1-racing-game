# F1 Racing Game - 벤치마킹 전략 및 분석

## 🏁 개요
현실적인 차량 물리 엔진과 변속 시스템을 구현하기 위한 벤치마킹 전략 및 실제 존재하는 오픈소스 프로젝트 분석

## 📊 벤치마킹 대상 프로젝트

## 아이디얼(최적) 레이싱 라인 오픈소스와 알고리즘 분석

### 오픈소스 현황 및 주요 구조

- **TUMFTM/global_racetrajectory_optimization**
  - 최적 레이싱 라인(아이디얼 라인) 생성 알고리즘을 여러 방식(최단 경로, 최소 곡률, 최소 시간, 파워트레인 반영)으로 지원[1].
  - 입력 데이터와 차량/트랙 파라미터(마찰계수, 곡률 등)를 바탕으로, 각 구간별 타겟 속도(vx), 곡률, 가속도 등 항목을 csv 등 출력 파일로 반환.
  - **최소 곡률, 최소 시간 트랙 생성 방식**:
    - 중심선에서 출발, 제한 내에서 경로를 미세 조정하며 차량 물리 한계(가속, 코너링력, 마찰 등)·트랙폭·최고속도 등을 고려.
    - 목표(예: 랩타임 최소화)에 따라 최적화 반복(비선형 계획법, 수치 해석 등).
    - 감속·조향 등은 트랙 곡률·정지거리 등에서 유도: 출력 파일에 각 지점별 목표 속도·가속도·곡률 등이 포함되어, 실제 차의 감속·조향 알고리즘 입력값으로 활용 가능.
  - **출력 예시**:
    | s_m(거리) | x | y | psi(방위각) | kappa(곡률) | vx(속도) | ax(가속도) |
    |-----------|---|---|------------|------------|----------|------------|
    | ...       | ... | ... | ...        | ...        | ...      | ...        |

- **abhisheknaik96/racing-line-optimization**
  - 2D 트랙 조건에서 가장 적합한(랩타임 최소) 레이싱 라인을 빠르게 계산하는 실험적 알고리즘 예시[2].
  - cost function(예: 트랙 이탈 최소화, 코너 진입 각도, 곡률, 속도 등) 기반 다양한 최적화 실험.

- **AI/게임엔진 적용 사례**
  - 센터라인/스플라인 기반으로 트랙 내 여러 후보 경로 생성 후, 가속·감속·조향 등을 각 점별로 미리 계산하여 "바람직한 속도 프로필" 포함한 데이터를 저장[3].
  - 유전 알고리즘, 수치 최적화, 머신러닝 기반(예: Genetic Algorithm, Matryoshka mapping, Euler spiral 등)으로 "최단 vs 최소 곡률 vs 최소 시간" 문제를 풀기도 함[4][5].
  - AI는 이 데이터를 참조해서 감속/가속/조향 제어(예: 현 구간의 목표 속도·곡률로 따라가기) 구현.

### F1 팀의 데이터 분석/활용 방식

- **고급 센서와 실차·시뮬레이터 데이터**
  - 차량의 위치(고정밀 GPS), 스티어링, 브레이크, 가속, 각 바퀴별 속도 등 수만개의 센서 데이터 실시간 수집
  - 각 구간별 드라이버의 실제 주행 라인, 감속/가속/조향 값, 타이어 마찰, 코너 진입 속도, 비교 주행 등 고해상도 분석[6][7].
- **레이싱 라인/주행 특성 분석**
  - 실차와 시뮬레이터 데이터 병합: 각 구간별 최적 라인, 감속·조향 입력 데이터, 타이어 사용률 등 랩 바이 랩 정밀 비교
  - 목표: 각 드라이버가 본인 포텐셜 및 트랙 한계에서 주행하는지 피드백 및 개선[6].
- **데이터 기반 시뮬레이션**
  - 수많은 시나리오(타이어 마모, 연료량, 트래픽, 변속 타이밍, 최적 경로 등) 예측 시뮬레이션 반복[8][7].
  - Monte Carlo/머신러닝 기반 시뮬레이션을 대량 돌려 각 전략·라인별 랩타임/경쟁력 추정 및 최적 전략 채택[9].

### 시뮬레이션 게임/AI의 구현 방법

- **트랙 표현**:
  - 대부분 "중앙선 스플라인"이나 "이산화된 경로점" 기반으로 트랙을 정의[3].
  - AI에겐 '이상적인 레이싱 라인' 데이터(위치, 목표 속도, 목표 조향값 등)를 별도 제공, AI는 이를 그대로 트래킹하거나 필요 시 실시간 조정.
- **AI 차량의 감속·조향 결정**:
  - 각 지점별로 랩타임 최소화 목적의 목표 속도·곡률 데이터를 참조해, 현재 속도와 비교하며 최적의 감속(브레이크), 가속, 조향값 생성[3].
  - 일부 게임은 실제 차량물리와 동일하게 '실시간 최적화/경로학습'을 벡엔드에 구현(유전 알고리즘/딥러닝 등)[5][4].
- **실전/상용 게임 구현**:
  - 고정된 레이싱라인의 경로 데이터와 '최적 속도프로필'을 맵 오브젝트로 포함시켜 AI가 랩타임 우선으로 참고하도록 함.
  - 하이엔드 시뮬레이터(Assetto Corsa, iRacing 등)는 실제 차량 세팅, 타이어 모델, 경로 최적화 알고리즘 등까지 복합 적용[10][3].

## 정리

- 다양한 오픈소스(예: TUMFTM, abhisheknaik96 등)에서 **최적 레이싱라인 + 속도/감속/조향 등 출력값**을 파일 형태로 직접 확인/활용 가능[1][2].
- F1팀은 실차·시뮬레이션 데이터와 고급센서, 대규모 분석 툴로 주행 라인, 감속, 조향 등 모든 요소를 실시간 분석 및 최적화[6][7].
- 상용 시뮬레이션 게임과 AI 역시 '이상적인 레이싱라인 + 구간별 목표 속도·조향 프로필'을 바탕으로 감속, 조향, 재가속을 구현하고 있음[3][10].

필요하다면 공개 알고리즘 상세 코드, 데이터 출력포맷 예시, 주요 논문 등도 추가 안내 가능합니다.

**참고 자료**
[1] https://github.com/TUMFTM/global_racetrajectory_optimization
[2] https://github.com/abhisheknaik96/racing-line-optimization
[4] https://dspace.cvut.cz/bitstream/handle/10467/112980/Klapalek_Novak_Sojka_et_al__Car_Racing_Line_Optimization_with_Genetic_Algorithm_using_Approximate_Homeomorphism__(2021)_AAM_353516.pdf?sequence=-1&isAllowed=y
[5] https://www.academia.edu/83476424/Evolving_the_optimal_racing_line_in_a_high_end_racing_game
[10] https://simracingcockpit.gg/sim-racing-games/
[9] https://www.raceteq.com/articles/2024/07/how-formula-1-teams-determine-the-fastest-race-strategy
[8] https://www.intrafocus.com/2024/04/the-data-driven-race-to-victory/
[6] https://theoriginalfour.com/en-mx/blogs/blog/mastering-the-art-of-precision-understanding-the-f1-racing-line
[7] https://michaelluzich.com/data-driven-dominance-how-real-time-analytics-are-reshaping-f1-race-strategy/
[3] http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter39_Representing_and_Driving_a_Race_Track_for_AI_Controlled_Vehicles.pdf

[1] https://github.com/TUMFTM/global_racetrajectory_optimization
[2] https://github.com/abhisheknaik96/racing-line-optimization
[3] http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter39_Representing_and_Driving_a_Race_Track_for_AI_Controlled_Vehicles.pdf
[4] https://dspace.cvut.cz/bitstream/handle/10467/112980/Klapalek_Novak_Sojka_et_al__Car_Racing_Line_Optimization_with_Genetic_Algorithm_using_Approximate_Homeomorphism__(2021)_AAM_353516.pdf?sequence=-1&isAllowed=y
[5] https://www.academia.edu/83476424/Evolving_the_optimal_racing_line_in_a_high_end_racing_game
[6] https://theoriginalfour.com/en-mx/blogs/blog/mastering-the-art-of-precision-understanding-the-f1-racing-line
[7] https://michaelluzich.com/data-driven-dominance-how-real-time-analytics-are-reshaping-f1-race-strategy/
[8] https://www.intrafocus.com/2024/04/the-data-driven-race-to-victory/
[9] https://www.raceteq.com/articles/2024/07/how-formula-1-teams-determine-the-fastest-race-strategy
[10] https://simracingcockpit.gg/sim-racing-games/
[11] https://dspace.mit.edu/bitstream/handle/1721.1/64669/706825301-MIT.pdf
[12] https://stevengong.co/notes/Raceline-Optimization
[13] https://www.youtube.com/watch?v=uIbTPvHFf-w
[14] https://www.reddit.com/r/Unity3D/comments/jlevef/best_way_to_implement_ai_in_a_racing_game/
[15] https://dl.acm.org/doi/10.1109/IROS51168.2021.9636503
[16] https://www.schoolofraceengineering.co.uk/blog/post/15986/how-do-teams-analyse-f1-race-strategy/
[17] https://arxiv.org/html/2410.04868v2
[18] https://physicsofformula1.wordpress.com/further-analysis-techniques/
[19] https://www.youtube.com/watch?v=FlieT66N9OM
[20] https://www.reddit.com/r/F1Technical/comments/1hjgpqh/optimal_racing_line/
[21] https://www.reddit.com/r/formula1/comments/22obaa/f1_track_racing_line_data/
[22] https://www.catapult.com/blog/formula-1-race-strategy-analysis
[23] https://www.gamedeveloper.com/design/implementing-racing-games-an-intro-to-different-approaches-and-their-game-design-trade-offs
[24] https://statathlon.com/analysis-of-the-pit-stop-strategy-in-f1/
[25] https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter38_An_Architecture_Overview_for_AI_in_Racing_Games.pdf
[26] https://www.catapult.com/blog/f1-data-analysis-transforming-performance
[27] https://discussions.unity.com/t/the-quest-for-a-better-racing-ai-system/492635
[28] https://www.bmw.com/en/performance/how-to-find-the-racing-line.html
[29] https://blog.oceanprotocol.com/formula-1-racing-challenge-2024-strategy-analysis-39c614f311e6
[30] https://www.reddit.com/r/motorsports/comments/16cey4c/racing_line_analysis/
[31] https://github.com/TomWebster98/Race-Strategy-Analysis
[32] https://www.mercedesamgf1.com/news/insight-how-teams-approach-a-new-track
[33] https://motorsportengineer.net/how-race-strategy-works-in-formula-1/
[34] https://www.nuerburgring-esports.com/blog/ai-application-sim-racing
[35] https://vedansh.vgoenka.com/f1-racing-line-optimization/
```

## 🔍 즉시 시작할 수 있는 벤치마킹

### 1. 프로젝트 분석
- 물리 엔진 코드 구조 파악
- 핵심 함수들 추출
- 우리 코드와의 차이점 분석

### 2. 핵심 기능 통합
- 물리 계산 로직 개선
- 차량 동역학 고도화
- 성능 최적화

### 3. 테스트 및 검증
- 현실성 검증
- 성능 테스트
- 사용자 경험 개선

## 📈 현재 구현된 기능

### 엔진 및 변속 시스템
- RPM 계산: `RPM = (speed * gearRatio * finalDriveRatio) / (2 * Math.PI * wheelRadius)`
- 토크 곡선: `torque = maxTorque * (1 - Math.pow((rpm - peakRPM) / (maxRPM - peakRPM), 2))`
- 파워 계산: `power = (torque * rpm * 2 * Math.PI) / 60000`
- 기어 시스템: N-R-1-2-3-4-5-6 (8단계)

### 물리 엔진
- 점진적 가속/감속
- 기어별 속도 제한
- 충돌 감지 시스템
- AI 드라이빙 로직

### UI 시스템
- 실시간 속도, 기어, RPM 표시
- 랩 타임 추적
- 디버그 정보

## 🚀 다음 단계

### 즉시 실행 가능한 작업
1. ** 프로젝트 코드 분석**
   - 물리 엔진 구조 파악
   - 핵심 알고리즘 추출
   - 우리 코드와 비교 분석

2. **핵심 기능 통합**
   - 고급 물리 계산 로직 적용
   - 차량 동역학 개선
   - 성능 최적화

3. **테스트 및 검증**
   - 현실성 검증
   - 성능 테스트
   - 사용자 경험 개선

### 장기 계획
- 3D 렌더링 시스템 도입
- 고급 AI 드라이빙 알고리즘
- 머신러닝 기반 AI 학습
- 멀티플레이어 지원

## 📚 참고 자료

### 수학적 기반
- **RPM 계산**: `RPM = (speed * gearRatio * finalDriveRatio) / (2 * Math.PI * wheelRadius)`
- **토크 곡선**: `torque = maxTorque * (1 - Math.pow((rpm - peakRPM) / (maxRPM - peakRPM), 2))`
- **파워 계산**: `power = (torque * rpm * 2 * Math.PI) / 60000`

### 물리 개념
- **기어비**: 엔진 RPM과 바퀴 회전수의 비율
- **토크**: 엔진이 발생시키는 회전력
- **파워**: 단위 시간당 수행하는 일의 양
- **클러치**: 엔진과 변속기 사이의 연결/해제 장치

## 🎮 개발 로드맵

### Phase 1: 벤치마킹 및 분석 (1주)
- [ ] KSSaadana 프로젝트 코드 분석
- [ ] 핵심 물리 엔진 로직 추출
- [ ] 우리 코드와의 차이점 분석

### Phase 2: 기능 통합 (2주)
- [ ] 고급 물리 엔진 적용
- [ ] 차량 동역학 개선
- [ ] 성능 최적화

### Phase 3: 고도화 (1주)
- [ ] 3D 요소 도입 검토
- [ ] AI 드라이빙 알고리즘 개선
- [ ] 사용자 인터페이스 개선

---

**마지막 업데이트**: 2025년 7월 20일
**상태**: 벤치마킹 대상 프로젝트 확인 완료