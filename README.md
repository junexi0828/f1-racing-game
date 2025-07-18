# 🏎️ F1 Circuit Racing Game

A React-based F1 racing game with advanced ideal line features, AI driving, and real-time lap time tracking.

## 🚀 Features

### Core Racing
- **Realistic Physics**: Car movement with acceleration, braking, reverse, and steering
- **Oval Track**: NASCAR-style oval circuit with proper racing lines
- **Lap Timing**: Real-time lap time measurement and best lap tracking
- **Camera Follow**: Smooth camera following the car

### Ideal Line System
- **Path Drawing**: Draw your ideal racing line using keyboard controls
- **AI Driving**: Let AI follow your drawn ideal line automatically
- **Path Deviation**: Real-time measurement of how far you deviate from the ideal line
- **Ideal Line Lap Time**: Compare your manual driving with AI performance
- **Visual Feedback**: See target points and path deviation in real-time

### Advanced Controls
- **Manual Driving**: WASD or Arrow keys for full control
- **Ideal Line Drawing**: Press 'I' to start/stop drawing your racing line
- **AI Driving**: Press 'O' to toggle AI auto-driving (requires drawn line)
- **Race Control**: Spacebar to start/stop races

## 🎮 How to Play

### Getting Started
1. Press **Space** to start the race
2. Use **WASD** or **Arrow keys** to control the car
3. Draw your ideal line by pressing **I** and driving around the track
4. Press **O** to let AI follow your ideal line

### Controls
| Action | Keys |
|--------|------|
| Accelerate | W / ↑ |
| Brake/Reverse | S / ↓ |
| Turn Left | A / ← |
| Turn Right | D / → |
| Start Race | Space |
| Draw Ideal Line | I |
| Toggle AI Driving | O |

### Game Features
- **Red Line**: Start/Finish line
- **Blue Areas**: Pit lane
- **Gray Areas**: Track surface
- **Dark Gray**: Off-track (slows you down)

## 🛠️ Technical Details

### Built With
- **React 19**: Modern React with hooks
- **Tailwind CSS**: Styling and responsive design
- **Canvas API**: Real-time graphics rendering
- **Custom Physics**: Car movement and collision detection

### Architecture
- **Grid-based Track**: 200x120 grid system for precise positioning
- **Custom Hooks**: Modular code organization (useIdealLine, useCarPhysics, useCarControls)
- **Real-time Updates**: 60fps physics and rendering
- **State Management**: React hooks for game state

### Ideal Line Algorithm
- **Path Recording**: Stores car position during drawing
- **Nearest Point Search**: Finds closest point on ideal line
- **Deviation Calculation**: Measures distance from ideal path
- **AI Steering**: Smooth angle interpolation for natural movement

## 📊 Game Statistics

The game tracks various metrics:
- **Current Lap Time**: Real-time lap timing
- **Best Lap Time**: Personal record tracking
- **Ideal Line Time**: AI performance benchmark
- **Path Deviation**: How far you are from your ideal line
- **Speed**: Current car velocity
- **Lap Count**: Number of completed laps

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/junexi0828/f1-racing-game.git

# Navigate to the project directory
cd f1-racing-game

# Install dependencies
npm install

# Start the development server
npm start
```

The game will open in your browser at `http://localhost:3000`

### Building for Production
```bash
npm run build
```

## 🎯 Tips for Better Performance

1. **Draw Smooth Lines**: Take your time to draw a smooth ideal line
2. **Practice Manual Driving**: Get comfortable with the controls first
3. **Compare Times**: Use the ideal line time as a benchmark
4. **Minimize Deviation**: Try to stay close to your ideal line for better times

## 🔧 Customization

You can modify various game parameters in `src/F1RacingGame.js`:
- `GRID_SIZE`: Change track resolution
- `GRID_WIDTH/HEIGHT`: Modify track dimensions
- Physics constants for car behavior
- Visual styling and colors

## 📝 License

This project is open source and available under the MIT License.

---

# 🏎️ F1 서킷 레이싱 게임

고급 아이디얼 라인 기능, AI 주행, 실시간 랩타임 추적이 포함된 React 기반 F1 레이싱 게임입니다.

## 🚀 주요 기능

### 핵심 레이싱
- **현실적인 물리**: 가속, 제동, 후진, 조향이 포함된 차량 움직임
- **타원형 트랙**: 적절한 레이싱 라인이 있는 NASCAR 스타일 타원 서킷
- **랩타임 측정**: 실시간 랩타임 측정 및 베스트 랩 추적
- **카메라 팔로우**: 차량을 부드럽게 따라가는 카메라

### 아이디얼 라인 시스템
- **경로 그리기**: 키보드 컨트롤을 사용하여 이상적인 레이싱 라인 그리기
- **AI 주행**: 그린 아이디얼 라인을 따라 자동으로 주행하는 AI
- **경로 편차**: 아이디얼 라인에서 얼마나 벗어났는지 실시간 측정
- **아이디얼 라인 랩타임**: 수동 주행과 AI 성능 비교
- **시각적 피드백**: 실시간으로 목표점과 경로 편차 확인

### 고급 컨트롤
- **수동 주행**: 완전한 제어를 위한 WASD 또는 화살표 키
- **아이디얼 라인 그리기**: 'I' 키를 눌러 레이싱 라인 그리기 시작/중지
- **AI 주행**: 'O' 키를 눌러 AI 자동 주행 토글 (그린 라인 필요)
- **레이스 제어**: 스페이스바로 레이스 시작/중지

## 🎮 게임 방법

### 시작하기
1. **스페이스**를 눌러 레이스 시작
2. **WASD** 또는 **화살표 키**를 사용하여 차량 제어
3. **I**를 눌러 아이디얼 라인 그리기 시작하고 트랙 주변을 주행
4. **O**를 눌러 AI가 아이디얼 라인을 따라가도록 설정

### 컨트롤
| 동작 | 키 |
|------|-----|
| 가속 | W / ↑ |
| 제동/후진 | S / ↓ |
| 좌회전 | A / ← |
| 우회전 | D / → |
| 레이스 시작 | 스페이스 |
| 아이디얼 라인 그리기 | I |
| AI 주행 토글 | O |

### 게임 기능
- **빨간 선**: 시작/종료 라인
- **파란 영역**: 피트 레인
- **회색 영역**: 트랙 표면
- **어두운 회색**: 오프트랙 (속도 감소)

## 🛠️ 기술적 세부사항

### 사용 기술
- **React 19**: 훅을 사용한 최신 React
- **Tailwind CSS**: 스타일링 및 반응형 디자인
- **Canvas API**: 실시간 그래픽 렌더링
- **커스텀 물리**: 차량 움직임 및 충돌 감지

### 아키텍처
- **그리드 기반 트랙**: 정확한 위치 지정을 위한 200x120 그리드 시스템
- **커스텀 훅**: 모듈화된 코드 구성 (useIdealLine, useCarPhysics, useCarControls)
- **실시간 업데이트**: 60fps 물리 및 렌더링
- **상태 관리**: 게임 상태를 위한 React 훅

### 아이디얼 라인 알고리즘
- **경로 기록**: 그리기 중 차량 위치 저장
- **최근접점 검색**: 아이디얼 라인에서 가장 가까운 점 찾기
- **편차 계산**: 이상적인 경로에서의 거리 측정
- **AI 조향**: 자연스러운 움직임을 위한 부드러운 각도 보간

## 📊 게임 통계

게임은 다양한 지표를 추적합니다:
- **현재 랩타임**: 실시간 랩 타이밍
- **베스트 랩타임**: 개인 기록 추적
- **아이디얼 라인 타임**: AI 성능 벤치마크
- **경로 편차**: 아이디얼 라인에서 얼마나 벗어났는지
- **속도**: 현재 차량 속도
- **랩 카운트**: 완주한 랩 수

## 🚀 시작하기

### 사전 요구사항
- Node.js (v14 이상)
- npm 또는 yarn

### 설치
```bash
# 저장소 클론
git clone https://github.com/junexi0828/f1-racing-game.git

# 프로젝트 디렉토리로 이동
cd f1-racing-game

# 의존성 설치
npm install

# 개발 서버 시작
npm start
```

게임이 브라우저에서 `http://localhost:3000`으로 열립니다.

### 프로덕션 빌드
```bash
npm run build
```

## 🎯 더 나은 성능을 위한 팁

1. **부드러운 라인 그리기**: 시간을 들여 부드러운 아이디얼 라인 그리기
2. **수동 주행 연습**: 먼저 컨트롤에 익숙해지기
3. **시간 비교**: 아이디얼 라인 타임을 벤치마크로 사용
4. **편차 최소화**: 더 나은 시간을 위해 아이디얼 라인에 가깝게 유지

## 🔧 커스터마이징

`src/F1RacingGame.js`에서 다양한 게임 매개변수를 수정할 수 있습니다:
- `GRID_SIZE`: 트랙 해상도 변경
- `GRID_WIDTH/HEIGHT`: 트랙 크기 수정
- 차량 동작을 위한 물리 상수
- 시각적 스타일링 및 색상

## 📝 라이선스

이 프로젝트는 오픈 소스이며 MIT 라이선스 하에 제공됩니다.
