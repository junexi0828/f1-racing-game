// F1 Circuit Racing 개선 버전
// - 실존 서킷 반영 대형 그리드(200x120 이상) 및 외부 데이터 구조
// - 도로 폭 내 자유 이동(도로 셀만 체크)
// - 아이디얼 라인 그리기/초기화/저장 로직 분리
// - 확장성(geojson, path 등) 고려 구조
// - 고해상도 대응(GRID_SIZE 4~6px)
// - 주요 상태 및 핸들러 분리

import React, { useState, useEffect, useCallback, useRef } from 'react';

// 1. 대형 서킷 그리드 및 trackLayout 분리
const GRID_SIZE = 6;
const GRID_WIDTH = 200;
const GRID_HEIGHT = 120;

// 1. 트랙 생성 함수 (나스카 원형, 도로폭 넓게, 스타트/피니시 라인 포함)
const createTrackLayout = () => {
    const W = 200, H = 120;
    const layout = Array(H).fill().map(() => Array(W).fill(0)); // 0=오프로드

    // === 원형 트랙 ===
    const cx = W / 2, cy = H / 2;
    const outerR = 60; // 바깥 반지름
    const innerR = 35; // 안쪽 반지름
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const dx = (x - cx) / 1.1; // 타원 비율 조정
            const dy = (y - cy);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < outerR && dist > innerR) layout[y][x] = 1; // 도로(흰색)
        }
    }
    // === 스타트/피니시 라인 (트랙 중앙 y, 도로 셀만 2로) ===
    const startFinishY = Math.floor(cy);
    for (let x = Math.floor(cx - outerR); x < Math.floor(cx + outerR); x++) {
        if (x >= 0 && x < W && layout[startFinishY][x] === 1) {
            layout[startFinishY][x] = 2; // 도로 셀만 2번으로 바꿈
        }
    }
    return layout;
};

// 도로 셀 판정 함수 (1, 2, 3이 도로)
const isRoadCell = (cell) => cell === 1 || cell === 2 || cell === 3;

// 2. 주요 상태 및 핸들러 분리
const useIdealLine = () => {
    const [idealLine, setIdealLine] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = useCallback(() => {
        setIsDrawing(true);
        setIdealLine([]);
    }, []);

    const stopDrawing = useCallback(() => setIsDrawing(false), []);
    const resetLine = useCallback(() => setIdealLine([]), []);
    const addPoint = useCallback((point) => setIdealLine((prev) => [...prev, point]), []);

    return { idealLine, isDrawing, startDrawing, stopDrawing, resetLine, addPoint };
};

// === 커스텀 훅: 키 입력 관리 ===
function useCarControls() {
    const keys = useRef({ up: false, down: false, left: false, right: false });
    useEffect(() => {
        const keyDownHandler = (event) => {
            const key = event.key.toLowerCase();
            switch (key) {
                case 'arrowup': case 'w': case 'ㅈ': keys.current.up = true; break;
                case 'arrowdown': case 's': case 'ㄴ': keys.current.down = true; break;
                case 'arrowleft': case 'a': case 'ㅁ': keys.current.left = true; break;
                case 'arrowright': case 'd': case 'ㅇ': keys.current.right = true; break;
                default: break;
            }
        };
        const keyUpHandler = (event) => {
            const key = event.key.toLowerCase();
            switch (key) {
                case 'arrowup': case 'w': case 'ㅈ': keys.current.up = false; break;
                case 'arrowdown': case 's': case 'ㄴ': keys.current.down = false; break;
                case 'arrowleft': case 'a': case 'ㅁ': keys.current.left = false; break;
                case 'arrowright': case 'd': case 'ㅇ': keys.current.right = false; break;
                default: break;
            }
        };
        window.addEventListener('keydown', keyDownHandler);
        window.addEventListener('keyup', keyUpHandler);
        return () => {
            window.removeEventListener('keydown', keyDownHandler);
            window.removeEventListener('keyup', keyUpHandler);
        };
    }, []);
    return keys;
}

// === 커스텀 훅: 차량 물리 처리 ===
function useCarPhysics({ isRacing, carAngle, speed, setCarAngle, setSpeed, carPosition, setCarPosition, trackLayout, isDrawing, addPoint, onCheckpointPass }) {
    const carAngleRef = useRef(carAngle);
    const speedRef = useRef(speed);
    useEffect(() => { carAngleRef.current = carAngle; }, [carAngle]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => {
        if (!isRacing) return;
        let running = true;
        function frame() {
            if (!running) return;
            setCarPosition(prev => {
                let newAngle = carAngleRef.current;
                let newSpeed = speedRef.current;
                // 조향
                if (window._carKeys?.left) newAngle -= 10;
                if (window._carKeys?.right) newAngle += 10;
                // 가속/감속
                if (window._carKeys?.up) newSpeed = Math.min(newSpeed + 1.2, 15);
                if (window._carKeys?.down) newSpeed = Math.max(newSpeed - 2.0, 0);
                if (!window._carKeys?.up && !window._carKeys?.down) newSpeed = Math.max(newSpeed - 0.1, 0);
                const angleRad = (newAngle * Math.PI) / 180;
                const newVelX = Math.sin(angleRad) * newSpeed * 0.8;
                const newVelY = -Math.cos(angleRad) * newSpeed * 0.8;
                const newX = prev.x + newVelX;
                const newY = prev.y + newVelY;
                const gridX = Math.floor(newX);
                const gridY = Math.floor(newY);
                if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) {
                    newSpeed = 0;
                    return prev;
                }
                if (!isRoadCell(trackLayout[gridY][gridX])) {
                    newSpeed = Math.max(newSpeed - 3, 0);
                    return prev;
                }
                // 아이디얼 라인 그리기
                if (isDrawing) addPoint({ x: newX, y: newY });
                setCarAngle(newAngle);
                setSpeed(newSpeed);
                onCheckpointPass({ x: newX, y: newY });
                return { x: newX, y: newY };
            });
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        return () => { running = false; };
    }, [isRacing, isDrawing, trackLayout, addPoint, setCarAngle, setSpeed, setCarPosition, onCheckpointPass]);
}

const F1RacingGame = () => {
    const [trackLayout] = useState(createTrackLayout());
    const trackLayoutRef = useRef(trackLayout);

    // 시작 위치가 도로인지 확인
    console.log('Start cell type:', trackLayout[28][100]); // 0이어야 도로
    console.log('Track layout at start position:', trackLayout[28][100]);
    console.log('Current car position:', { x: 100, y: 28 });
    console.log('Is road cell:', isRoadCell(trackLayout[28][100]));

    // 차량 시작 위치를 스타트/피니시 라인 위로 정확히 설정
    const cx = 200 / 2, cy = 120 / 2, outerR = 55;
    const startFinishY = Math.floor(cy);
    const startX = Math.floor(cx + outerR) - 5;
    const [carPosition, setCarPosition] = useState({ x: startX, y: startFinishY });
    const [carAngle, setCarAngle] = useState(180); // 왼쪽(서쪽) 방향
    const [speed, setSpeed] = useState(0);
    const [isRacing, setIsRacing] = useState(false);
    const [currentLapTime, setCurrentLapTime] = useState(0);
    const [bestLapTime, setBestLapTime] = useState(null);
    const [lapStartTime, setLapStartTime] = useState(null);
    const [hasPassedStart, setHasPassedStart] = useState(false);
    const [lapCount, setLapCount] = useState(0);
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    // keys를 useRef로만 관리하여 성능 최적화
    const keysRef = useRef({ up: false, down: false, left: false, right: false });

    // 최신 상태값에 접근하기 위한 ref
    const carAngleRef = useRef(carAngle);
    const speedRef = useRef(speed);
    const hasPassedStartRef = useRef(hasPassedStart);
    const lapStartTimeRef = useRef(lapStartTime);
    const bestLapTimeRef = useRef(bestLapTime);

    // ref 업데이트
    useEffect(() => { carAngleRef.current = carAngle; }, [carAngle]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { hasPassedStartRef.current = hasPassedStart; }, [hasPassedStart]);
    useEffect(() => { lapStartTimeRef.current = lapStartTime; }, [lapStartTime]);
    useEffect(() => { bestLapTimeRef.current = bestLapTime; }, [bestLapTime]);

    // 아이디얼 라인 핸들러
    const { idealLine, isDrawing, startDrawing, stopDrawing, resetLine, addPoint } = useIdealLine();
    const addPointRef = useRef(addPoint);

    // addPoint ref 업데이트
    useEffect(() => { addPointRef.current = addPoint; }, [addPoint]);

    const startRace = useCallback(() => {
        console.log('Starting race...'); // 디버깅 로그
        setIsRacing(true);
        setCarPosition({ x: startX, y: startFinishY }); // 항상 스타트/피니시 라인 위로 이동
        setCarAngle(180);
        setSpeed(0);
        setCurrentLapTime(0);
        setLapStartTime(null);
        setHasPassedStart(false);
        setLapCount(0);
    }, []);

    const stopRace = useCallback(() => {
        setIsRacing(false);
        setSpeed(0);
        setLapStartTime(null);
    }, []);

    // 체크포인트 제거
    const checkpoints = [];
    // 체크포인트 4개 (가로선만, 트랙 내 y값만 다르게)
    const CHECKPOINT_RADIUS = 3; // 체크포인트 판정 반경(작게)
    const [checkpointIndex, setCheckpointIndex] = useState(0); // 다음 통과해야 할 체크포인트
    const [passedAllCheckpoints, setPassedAllCheckpoints] = useState(false);

    // 키 입력 커스텀 훅
    const keys = useCarControls();
    // window에 키 상태 공유(물리 훅에서 접근)
    useEffect(() => { window._carKeys = keys.current; });

    // onCheckpointPass는 빈 함수로 변경
    const onCheckpointPass = useCallback(() => { }, []);

    // 랩 완주 판정(시작/피니시 라인 + 모든 체크포인트 통과)
    useEffect(() => {
        if (!isRacing) return;
        const { x, y } = carPosition;
        const gridX = Math.floor(x);
        const gridY = Math.floor(y);
        if (trackLayout[gridY][gridX] === 2 && passedAllCheckpoints) {
            if (hasPassedStart && lapStartTime) {
                const lapTime = Date.now() - lapStartTime;
                setCurrentLapTime(lapTime);
                setLapCount(prev => prev + 1);
                if (!bestLapTime || lapTime < bestLapTime) setBestLapTime(lapTime);
                setLapStartTime(Date.now());
                setHasPassedStart(false);
                setPassedAllCheckpoints(false);
            } else if (!hasPassedStart) {
                setHasPassedStart(true);
                if (!lapStartTime) setLapStartTime(Date.now());
            }
        }
    }, [carPosition, isRacing, passedAllCheckpoints, hasPassedStart, lapStartTime, bestLapTime, trackLayout]);

    // 차량 물리 커스텀 훅
    useCarPhysics({
        isRacing,
        carAngle,
        speed,
        setCarAngle,
        setSpeed,
        carPosition,
        setCarPosition,
        trackLayout,
        isDrawing,
        addPoint,
        onCheckpointPass
    });

    // 키보드 입력 처리는 useEffect 내부에서 직접 처리

    useEffect(() => {
        console.log('Adding keyboard event listeners'); // 디버깅 로그 추가

        const keyDownHandler = (event) => {
            const key = event.key.toLowerCase();
            console.log('=== KEY DOWN EVENT ===');
            console.log('Key pressed:', key, 'isRacing:', isRacing);
            console.log('Event target:', event.target);
            console.log('Current keysRef before:', keysRef.current);

            switch (key) {
                case 'arrowup': case 'w': case 'ㅈ':
                    keysRef.current.up = true;
                    console.log('W/Up/ㅈ key pressed, keysRef after:', keysRef.current);
                    break;
                case 'arrowdown': case 's': case 'ㄴ':
                    keysRef.current.down = true;
                    console.log('S/Down/ㄴ key pressed, keysRef after:', keysRef.current);
                    break;
                case 'arrowleft': case 'a': case 'ㅁ':
                    keysRef.current.left = true;
                    console.log('A/Left/ㅁ key pressed, keysRef after:', keysRef.current);
                    break;
                case 'arrowright': case 'd': case 'ㅇ':
                    keysRef.current.right = true;
                    console.log('D/Right/ㅇ key pressed, keysRef after:', keysRef.current);
                    break;
                case ' ':
                    event.preventDefault();
                    if (!isRacing) startRace();
                    break;
                case 'i':
                    isDrawing ? stopDrawing() : startDrawing();
                    break;
                default: break;
            }
        };

        const keyUpHandler = (event) => {
            const key = event.key.toLowerCase();
            switch (key) {
                case 'arrowup': case 'w': case 'ㅈ':
                    keysRef.current.up = false;
                    break;
                case 'arrowdown': case 's': case 'ㄴ':
                    keysRef.current.down = false;
                    break;
                case 'arrowleft': case 'a': case 'ㅁ':
                    keysRef.current.left = false;
                    break;
                case 'arrowright': case 'd': case 'ㅇ':
                    keysRef.current.right = false;
                    break;
                default: break;
            }
        };

        window.addEventListener('keydown', keyDownHandler);
        window.addEventListener('keyup', keyUpHandler);

        return () => {
            console.log('Removing keyboard event listeners');
            window.removeEventListener('keydown', keyDownHandler);
            window.removeEventListener('keyup', keyUpHandler);
        };
    }, [isRacing, isDrawing, startRace]);

    // 카메라 팔로우
    useEffect(() => {
        const targetX = carPosition.x * GRID_SIZE - 400;
        const targetY = carPosition.y * GRID_SIZE - 300;
        setCameraOffset(prev => ({
            x: prev.x + (targetX - prev.x) * 0.9,
            y: prev.y + (targetY - prev.y) * 0.9
        }));
    }, [carPosition]);

    // 실시간 랩타임 업데이트
    useEffect(() => {
        if (!isRacing || !lapStartTime) return;
        const interval = setInterval(() => {
            setCurrentLapTime(Date.now() - lapStartTime);
        }, 100);
        return () => clearInterval(interval);
    }, [isRacing, lapStartTime]);

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60000);
        const seconds = Math.floor((time % 60000) / 1000);
        const milliseconds = Math.floor((time % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center p-4 bg-gray-900 min-h-screen text-white">
            <h1 className="text-3xl font-bold mb-4 text-red-500">🏎️ F1 Circuit Racing</h1>
            {/* 게임 정보 */}
            <div className="flex gap-4 mb-4 text-sm">
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Current Lap</div>
                    <div className="text-lg font-mono">{formatTime(currentLapTime)}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Best Lap</div>
                    <div className="text-lg font-mono text-yellow-400">
                        {bestLapTime ? formatTime(bestLapTime) : '--:--'}
                    </div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Laps</div>
                    <div className="text-lg font-mono">{lapCount}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Speed</div>
                    <div className="text-lg font-mono">{speed.toFixed(1)}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Ideal Line</div>
                    <div className="text-lg font-mono">{isDrawing ? 'ON' : 'OFF'}</div>
                </div>
            </div>
            {/* 게임 뷰포트 */}
            <div
                className="relative bg-gray-800 border-2 border-gray-600 overflow-hidden"
                style={{ width: 800, height: 600 }}
            >
                {/* 트랙 및 차량 렌더링 */}
                <div
                    className="absolute"
                    style={{
                        transform: `translate(${-cameraOffset.x}px, ${-cameraOffset.y}px)`,
                        width: GRID_WIDTH * GRID_SIZE,
                        height: GRID_HEIGHT * GRID_SIZE,
                    }}
                >
                    {/* 트랙 렌더링 */}
                    {trackLayout.map((row, y) =>
                        row.map((cell, x) => (
                            <div
                                key={`${x}-${y}`}
                                className={`absolute ${cell === 0 ? 'bg-gray-700' :      // 오프로드(벽)
                                    cell === 1 ? 'bg-gray-300' :      // 도로
                                        cell === 2 ? 'bg-red-500' :       // 스타트/피니시
                                            cell === 3 ? 'bg-blue-500' :      // 피트레인
                                                'bg-gray-700'
                                    }`}
                                style={{
                                    left: x * GRID_SIZE,
                                    top: y * GRID_SIZE,
                                    width: GRID_SIZE,
                                    height: GRID_SIZE,
                                    border: cell === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                }}
                            />
                        ))
                    )}
                    {/* 체크포인트(캔버스, 원형 트랙에 맞게) */}
                    <canvas
                        width={GRID_WIDTH * GRID_SIZE}
                        height={GRID_HEIGHT * GRID_SIZE}
                        ref={el => {
                            if (!el) return;
                            const ctx = el.getContext('2d');
                            ctx.clearRect(0, 0, el.width, el.height);
                            checkpoints.forEach((cp, idx) => {
                                ctx.beginPath();
                                if (cp.x1 !== undefined) {
                                    // 가로선
                                    ctx.moveTo(cp.x1 * GRID_SIZE, cp.y * GRID_SIZE);
                                    ctx.lineTo(cp.x2 * GRID_SIZE, cp.y * GRID_SIZE);
                                } else {
                                    // 세로선
                                    ctx.moveTo(cp.x * GRID_SIZE, cp.y1 * GRID_SIZE);
                                    ctx.lineTo(cp.x * GRID_SIZE, cp.y2 * GRID_SIZE);
                                }
                                ctx.strokeStyle = idx === checkpointIndex ? 'rgba(0,255,0,0.7)' : 'rgba(0,0,255,0.4)';
                                ctx.lineWidth = 4;
                                ctx.stroke();
                                ctx.font = 'bold 16px sans-serif';
                                ctx.fillStyle = '#fff';
                                if (cp.x1 !== undefined) {
                                    ctx.fillText(`${idx + 1}`, ((cp.x1 + cp.x2) / 2) * GRID_SIZE - 6, cp.y * GRID_SIZE - 8);
                                } else {
                                    ctx.fillText(`${idx + 1}`, cp.x * GRID_SIZE + 6, ((cp.y1 + cp.y2) / 2) * GRID_SIZE);
                                }
                            });
                        }}
                        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 2 }}
                    />
                    {/* 아이디얼 라인(캔버스) */}
                    <canvas
                        width={GRID_WIDTH * GRID_SIZE}
                        height={GRID_HEIGHT * GRID_SIZE}
                        ref={el => {
                            if (!el) return;
                            const ctx = el.getContext('2d');
                            ctx.clearRect(0, 0, el.width, el.height);
                            if (idealLine.length > 1) {
                                ctx.beginPath();
                                ctx.moveTo(idealLine[0].x * GRID_SIZE, idealLine[0].y * GRID_SIZE);
                                for (let i = 1; i < idealLine.length; i++) {
                                    ctx.lineTo(idealLine[i].x * GRID_SIZE, idealLine[i].y * GRID_SIZE);
                                }
                                ctx.strokeStyle = 'rgba(0,255,255,0.7)';
                                ctx.lineWidth = 3;
                                ctx.stroke();
                            }
                        }}
                        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 3 }}
                    />
                    {/* F1 차량 */}
                    <div
                        className="absolute bg-red-500 rounded-sm flex items-center justify-center text-white text-lg font-bold transition-transform duration-75"
                        style={{
                            left: carPosition.x * GRID_SIZE - 18,
                            top: carPosition.y * GRID_SIZE - 18,
                            width: 36,
                            height: 36,
                            transform: `rotate(${carAngle}deg)`,
                            zIndex: 10,
                            fontSize: 32 // 이모티콘도 같이 커지게
                        }}
                    >
                        🐷
                    </div>
                </div>
                {/* 미니맵 */}
                <div className="absolute top-4 right-4 bg-black bg-opacity-70 p-2 rounded">
                    <div className="text-xs text-gray-300 mb-1">Track Map</div>
                    <div
                        className="relative"
                        style={{ width: 120, height: 75 }}
                    >
                        {/* 미니맵 트랙 */}
                        {trackLayout.map((row, y) =>
                            row.map((cell, x) => (
                                <div
                                    key={`mini-${x}-${y}`}
                                    className={`absolute ${cell === 1 ? 'bg-gray-500' :
                                        cell === 2 ? 'bg-red-400' :
                                            cell === 3 ? 'bg-blue-400' :
                                                'bg-gray-700'
                                        }`}
                                    style={{
                                        left: (x / GRID_WIDTH) * 120,
                                        top: (y / GRID_HEIGHT) * 75,
                                        width: 120 / GRID_WIDTH,
                                        height: 75 / GRID_HEIGHT,
                                    }}
                                />
                            ))
                        )}
                        {/* 미니맵 차량 */}
                        <div
                            className="absolute bg-red-500 rounded-full"
                            style={{
                                left: (carPosition.x / GRID_WIDTH) * 120 - 2,
                                top: (carPosition.y / GRID_HEIGHT) * 75 - 2,
                                width: 4,
                                height: 4,
                            }}
                        />
                    </div>
                </div>
            </div>
            {/* 컨트롤 */}
            <div className="mt-4 text-center">
                <div className="mb-4 flex gap-4">
                    {!isRacing ? (
                        <button
                            onClick={startRace}
                            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-bold"
                        >
                            START RACE (Space)
                        </button>
                    ) : (
                        <button
                            onClick={stopRace}
                            className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded font-bold"
                        >
                            STOP RACE
                        </button>
                    )}
                    <button
                        onClick={() => { isDrawing ? stopDrawing() : startDrawing(); }}
                        className={`px-4 py-2 rounded font-bold ${isDrawing ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-gray-600 hover:bg-gray-700'
                            }`}
                    >
                        {isDrawing ? 'Stop Drawing' : 'Draw Ideal Line'} (I)
                    </button>
                    <button
                        onClick={resetLine}
                        className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded font-bold"
                    >
                        Clear Line
                    </button>
                </div>
                <div className="text-sm text-gray-400 grid grid-cols-2 gap-4">
                    <div>
                        <div className="font-bold mb-1">🏎️ Controls:</div>
                        <div>W/↑: Accelerate</div>
                        <div>S/↓: Brake</div>
                        <div>A/←: Turn Left</div>
                        <div>D/→: Turn Right</div>
                    </div>
                    <div>
                        <div className="font-bold mb-1">🎯 Features:</div>
                        <div>I: Toggle Ideal Line</div>
                        <div>Space: Start/Restart</div>
                        <div>🔴 Red: Start/Finish Line</div>
                        <div>🔵 Blue: Pit Lane</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default F1RacingGame;