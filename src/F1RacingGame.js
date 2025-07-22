// F1 Circuit Racing 개선 버전
// - 실존 서킷 반영 대형 그리드(200x120 이상) 및 외부 데이터 구조
// - 도로 폭 내 자유 이동(도로 셀만 체크)
// - 아이디얼 라인 그리기/초기화/저장 로직 분리
// - 확장성(geojson, path 등) 고려 구조
// - 고해상도 대응(GRID_SIZE 4~6px)
// - 주요 상태 및 핸들러 분리
// - 변속 시스템 추가 (기어, RPM, 자동/수동 변속)

import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- 분리된 함수/로직 import ---
import { createTrackLayout, isRoadCell } from './track/trackLayout';
import { updateVehiclePhysics, calculateWallCollision, findNearestRoadPoint, calculateReflectionAngle } from './engine/physicsEngine';
import { findNextTargetPoint, calculatePathDeviation } from './ai/aiController';

// --- 아래 함수들은 분리 모듈로 이동했으므로 주석처리 ---
/*
const createTrackLayout = ...
const isRoadCell = ...
const calculateWallCollision = ...
const findNearestRoadPoint = ...
const calculateReflectionAngle = ...
const findNextTargetPoint = ...
const calculatePathDeviation = ...
const findNearestPoint = ...
const distance = ...
*/
// 나머지 기존 코드 유지

// 1. 대형 서킷 그리드 및 trackLayout 분리
const GRID_SIZE = 6;
const GRID_WIDTH = 200;
const GRID_HEIGHT = 120;

// 일반 차량 기준 변속 시스템 상수
const GEAR_SYSTEM = {
    // 기어별 최고 속도 (KM/h 기준, 일반 차량)
    MAX_SPEED_PER_GEAR: [0, 0, 35, 60, 90, 130, 170, 210], // N(0), R(1), 1-6단 - 현실적으로 조정
    // 기어별 속도 비율 (RPM → 속도 변환 계수) - 더 현실적으로 조정
    GEAR_SPEED_RATIO: [0, 0, 0.010, 0.013, 0.016, 0.019, 0.022, 0.025], // N(0), R(1), 1-6단 - 현실적으로 조정
    // 최적 변속 RPM (일반 차량 기준) - 더 낮은 임계값
    OPTIMAL_SHIFT_RPM: [0, 0, 1800, 2200, 2600, 3000, 3400, 3800], // N(0), R(1), 1-6단 - 현실적으로 조정
    // 엔진 설정
    IDLE_RPM: 800, // 공회전 RPM
    MAX_RPM: 6000, // 최대 RPM (일반 차량)
    // RPM 증가 제한 (프레임당)
    RPM_INCREASE_PER_FRAME: 50, // RPM 증가량 감소 (더 부드럽게) // 프레임당 최대 RPM 증가량 (더 빠르게)
    RPM_DECAY_RATE: 0.98, // RPM 감소율 (더 빠르게)
    // 변속 설정
    AUTO_SHIFT_DELAY: 1000, // 자동 변속 지연시간 (ms) - 더 안정적으로
    MANUAL_SHIFT_DELAY: 300, // 수동 변속 쿨다운 (ms) - 더 안정적으로
};

// 1. 트랙 생성 함수 (나스카 원형, 도로폭 넓게, 스타트/피니시 라인 포함)
// const createTrackLayout = () => {
//     const W = 200, H = 120;
//     const layout = Array(H).fill().map(() => Array(W).fill(0)); // 0=오프로드

//     // === 원형 트랙 ===
//     const cx = W / 2, cy = H / 2;
//     const outerR = 60; // 바깥 반지름
//     const innerR = 35; // 안쪽 반지름
//     for (let y = 0; y < H; y++) {
//         for (let x = 0; x < W; x++) {
//             const dx = (x - cx) / 1.1; // 타원 비율 조정
//             const dy = (y - cy);
//             const dist = Math.sqrt(dx * dx + dy * dy);
//             if (dist < outerR && dist > innerR) layout[y][x] = 1; // 도로(흰색)
//         }
//     }
//     // === 스타트/피니시 라인 (트랙 중앙 y, 도로 셀만 2로) ===
//     const startFinishY = Math.floor(cy);
//     for (let x = Math.floor(cx - outerR); x < Math.floor(cx + outerR); x++) {
//         if (x >= 0 && x < W && layout[startFinishY][x] === 1) {
//             layout[startFinishY][x] = 2; // 도로 셀만 2번으로 바꿈
//         }
//     }
//     return layout;
// };

// 도로 셀 판정 함수 (1, 2, 3이 도로)
// const isRoadCell = (cell) => cell === 1 || cell === 2 || cell === 3;

// === 아이디얼 라인 유틸리티 함수들 ===
// 두 점 사이의 거리 계산
// const distance = (p1, p2) => {
//     return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
// };

// 아이디얼 라인에서 가장 가까운 포인트 찾기
// const findNearestPoint = (currentPos, idealLine) => {
//     if (idealLine.length === 0) return null;

//     let nearest = idealLine[0];
//     let minDist = distance(currentPos, nearest);

//     for (let i = 1; i < idealLine.length; i++) {
//         const dist = distance(currentPos, idealLine[i]);
//         if (dist < minDist) {
//             minDist = dist;
//             nearest = idealLine[i];
//         }
//     }

//     return { point: nearest, distance: minDist };
// };

// 경로 편차 계산 (아이디얼 라인에서 얼마나 벗어났는지)
// const calculatePathDeviation = (currentPos, idealLine) => {
//     const nearest = findNearestPoint(currentPos, idealLine);
//     return nearest ? nearest.distance : 0;
// };

// AI 자동 주행을 위한 다음 목표점 찾기
// const findNextTargetPoint = (currentPos, idealLine, lookAhead = 5) => {
//     if (idealLine.length === 0) return null;

//     const nearest = findNearestPoint(currentPos, idealLine);
//     if (!nearest) return null;

//     const currentIndex = idealLine.indexOf(nearest.point);
//     const nextIndex = Math.min(currentIndex + lookAhead, idealLine.length - 1);

//     return idealLine[nextIndex];
// };

// === 충돌 물리 시스템 ===
// 벽과의 충돌 감지 및 반사 계산
// const calculateWallCollision = (currentPos, newPos, carAngle, speed, trackLayout) => {
//     const gridX = Math.floor(newPos.x);
//     const gridY = Math.floor(newPos.y);

//     // 트랙 밖으로 나간 경우
//     if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) {
//         return {
//             collision: true,
//             position: currentPos, // 원래 위치 유지
//             angle: carAngle + 180, // 반대 방향으로 튕김
//             speed: Math.max(speed * 0.1, 0), // 속도 90% 감소
//             type: 'boundary'
//         };
//     }

//     // 오프로드(벽)에 부딪힌 경우
//     if (!isRoadCell(trackLayout[gridY][gridX])) {
//         // 충돌 지점에서 가장 가까운 도로 찾기
//         const nearestRoad = findNearestRoadPoint(newPos, trackLayout);

//         return {
//             collision: true,
//             position: nearestRoad || currentPos,
//             angle: calculateReflectionAngle(carAngle, newPos, currentPos),
//             speed: Math.max(speed * 0.2, 0), // 속도 80% 감소
//             type: 'wall'
//         };
//     }

//     return { collision: false };
// };

// 가장 가까운 도로 지점 찾기
// const findNearestRoadPoint = (pos, trackLayout) => {
//     const searchRadius = 5;
//     for (let radius = 1; radius <= searchRadius; radius++) {
//         for (let dy = -radius; dy <= radius; dy++) {
//             for (let dx = -radius; dx <= radius; dx++) {
//                 const x = Math.floor(pos.x) + dx;
//                 const y = Math.floor(pos.y) + dy;

//                 if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
//                     if (isRoadCell(trackLayout[y][x])) {
//                         return { x: x + 0.5, y: y + 0.5 };
//                     }
//                 }
//             }
//         }
//     }
//     return null;
// };

// 반사 각도 계산
// const calculateReflectionAngle = (carAngle, collisionPos, prevPos) => {
//     // 충돌 방향 계산
//     const collisionDirX = collisionPos.x - prevPos.x;
//     const collisionDirY = collisionPos.y - prevPos.y;

//     // 충돌 각도 계산
//     const collisionAngle = Math.atan2(collisionDirY, collisionDirX) * 180 / Math.PI;

//     // 반사 각도 = 충돌 각도 + 180도 + 랜덤 요소
//     const reflectionAngle = collisionAngle + 180 + (Math.random() - 0.5) * 60;

//     return reflectionAngle;
// };

// 2. 주요 상태 및 핸들러 분리
const useIdealLine = () => {
    const [idealLine, setIdealLine] = useState([]); // 경로 포인트 배열
    const [isDrawing, setIsDrawing] = useState(false); // 그리기 모드
    const [isAIDriving, setIsAIDriving] = useState(false); // AI 자동 주행 모드
    const [pathDeviation, setPathDeviation] = useState(0); // 경로 편차
    const [idealLineTime, setIdealLineTime] = useState(null); // 아이디얼 라인 기준 랩타임

    const startDrawing = useCallback(() => {
        setIsDrawing(true);
        setIdealLine([]); // 새로 그리기 시작
        setIsAIDriving(false); // AI 주행 중지
    }, []);

    const stopDrawing = useCallback(() => setIsDrawing(false), []);
    const resetLine = useCallback(() => {
        setIdealLine([]);
        setIsAIDriving(false);
        setPathDeviation(0);
        setIdealLineTime(null);
    }, []);
    const addPoint = useCallback((point) => setIdealLine((prev) => [...prev, point]), []);

    // AI 자동 주행 토글
    const toggleAIDriving = useCallback(() => {
        if (idealLine.length > 10) { // 최소 10개 포인트 필요
            setIsAIDriving(prev => !prev);
        }
    }, [idealLine.length]);

    return {
        idealLine,
        isDrawing,
        isAIDriving,
        pathDeviation,
        idealLineTime,
        startDrawing,
        stopDrawing,
        resetLine,
        addPoint,
        toggleAIDriving,
        setPathDeviation,
        setIdealLineTime
    };
};

// === 커스텀 훅: 변속 시스템 관리 ===
function useGearSystem() {
    const [currentGear, setCurrentGear] = useState(0); // N(중립)으로 시작
    const [engineRPM, setEngineRPM] = useState(GEAR_SYSTEM.IDLE_RPM);
    const [isAutoShift, setIsAutoShift] = useState(true);
    const [manualShiftMode, setManualShiftMode] = useState(false);
    const [lastShiftTime, setLastShiftTime] = useState(0);
    const [gearDisplay, setGearDisplay] = useState('1');
    const [isInitialized, setIsInitialized] = useState(false);

    // === [기어 범위 강제 제한 및 디버깅 로그 추가] ===
    // safeSetCurrentGear를 최상단에 선언 (모든 참조보다 먼저!)
    const safeSetCurrentGear = useCallback((newGear) => {
        const maxGear = GEAR_SYSTEM.MAX_SPEED_PER_GEAR.length - 1;
        const safeGear = Math.min(Math.max(newGear, 0), maxGear);
        if (safeGear !== newGear) {
            console.warn('setCurrentGear: Invalid gear', newGear, '->', safeGear);
        }
        setCurrentGear(safeGear);
    }, []);

    // 기어 값 유효성 검사 및 수정 (무한 루프 방지)
    useEffect(() => {
        // N(0), R(1), 1-6단(2-7) 범위 검사
        if (currentGear < 0 || currentGear > 7) {
            console.warn('Invalid gear value detected:', currentGear, 'resetting to N(0)');
            if (currentGear !== 0) {
                setCurrentGear(0);
            }
        }
        // === [기어 범위 강제 제한] ===
        const maxGear = GEAR_SYSTEM.MAX_SPEED_PER_GEAR.length - 1; // 7(6단)
        if (currentGear > maxGear) {
            console.warn('Gear exceeds maxGear:', currentGear, '->', maxGear);
            setCurrentGear(maxGear);
        }
        if (currentGear < 0) {
            setCurrentGear(0);
        }
    }, [currentGear]);

    // 기어 상태 안정화 (무한 루프 방지) - 한 번만 실행
    useEffect(() => {
        // 기어가 0이 아닌데 유효하지 않은 경우에만 수정
        if (currentGear !== 0 && (currentGear < 1 || currentGear > 6)) {
            console.warn('Gear stabilization: invalid gear', currentGear, '-> 1');
            setCurrentGear(1);
        }
    }, []); // 의존성 배열을 비워서 한 번만 실행

    // 디버깅: 초기화 확인 (한 번만 실행)
    useEffect(() => {
        if (!isInitialized) {
            console.log('useGearSystem initialized with:', {
                currentGear,
                engineRPM,
                isAutoShift,
                GEAR_SYSTEM_MAX_SPEED: GEAR_SYSTEM.MAX_SPEED_PER_GEAR
            });
            setIsInitialized(true);
        }
    }, [isInitialized, currentGear, engineRPM, isAutoShift]);

    // 현실적인 RPM 계산 (속도 → RPM)
    const calculateRPM = useCallback((speed, gear) => {
        // 입력값 검증
        if (typeof speed !== 'number' || isNaN(speed)) {
            console.warn('Invalid speed value:', speed);
            return GEAR_SYSTEM.IDLE_RPM;
        }

        // === 기어 범위 방어 코드 추가 ===
        const maxGear = GEAR_SYSTEM.MAX_SPEED_PER_GEAR.length - 1;
        const safeGear = Math.min(Math.max(gear, 0), maxGear);
        if (safeGear !== gear) {
            console.warn(`Invalid gear corrected: ${gear} -> ${safeGear}`);
        }

        if (safeGear === 0) return GEAR_SYSTEM.IDLE_RPM; // 중립

        // === getGearSpeedLimit undefined 방지 ===
        const gearSpeedRatio = GEAR_SYSTEM.GEAR_SPEED_RATIO[safeGear];
        if (typeof gearSpeedRatio !== 'number' || isNaN(gearSpeedRatio) || gearSpeedRatio === 0) {
            console.warn('getGearSpeedLimit: invalid for gear', safeGear, 'fallback 0.01');
            return GEAR_SYSTEM.IDLE_RPM;
        }

        // 일반 차량 기준 RPM 계산: 속도를 KM/h로 변환 후 RPM 계산
        const speedKMH = Math.abs(speed) * 10; // 게임 속도를 KM/h로 변환 (대략적)
        const rpm = speedKMH / gearSpeedRatio;

        const result = Math.max(GEAR_SYSTEM.IDLE_RPM,
            Math.min(GEAR_SYSTEM.MAX_RPM, rpm));

        // 디버깅: RPM 계산 (속도가 있을 때만) - 로그 빈도 줄임
        if (speed > 5.0) { // 로그 빈도 더 줄임
            console.log(`RPM Calc - Speed: ${speed.toFixed(1)} (${speedKMH.toFixed(0)}km/h), Gear: ${safeGear}, RPM: ${Math.round(result)}`);
        }

        return result;
    }, []);

    // 자동 변속 로직 - 안전한 범위 제한
    const autoShift = useCallback((currentRPM, currentSpeed, throttle = 0) => {
        const now = Date.now();
        if (now - lastShiftTime < GEAR_SYSTEM.AUTO_SHIFT_DELAY) return;
        let safeGear = currentGear;
        const maxGear = GEAR_SYSTEM.MAX_SPEED_PER_GEAR.length - 1;
        if (currentGear < 0 || currentGear > maxGear) {
            safeSetCurrentGear(0);
            return;
        }
        // N(중립)에서 가속 페달 입력 시 1단으로 자동 변속
        if (safeGear === 0 && throttle > 0) {
            safeSetCurrentGear(2);
            setLastShiftTime(now);
            return;
        }
        // R(후진)에서 가속 페달 입력 시 N으로 변속
        if (safeGear === 1 && throttle > 0) {
            safeSetCurrentGear(0);
            setLastShiftTime(now);
            return;
        }
        if (safeGear === 0 || safeGear === 1) {
            return;
        }
        if (safeGear < 2 || safeGear > maxGear) {
            return;
        }
        const optimalRPM = GEAR_SYSTEM.OPTIMAL_SHIFT_RPM[safeGear];
        // === [기어 업 조건 보수적 조정] ===
        if (currentRPM > optimalRPM * 0.95 && safeGear < maxGear) {
            const newGear = safeGear + 1;
            safeSetCurrentGear(newGear);
            setLastShiftTime(now);
            return;
        }
        if (safeGear >= maxGear && currentRPM > optimalRPM * 0.95) {
            return;
        }
        // 다운시프트: 낮은 RPM에서 하위 기어로
        if (currentRPM < optimalRPM * 0.5 && safeGear > 2) {
            const newGear = safeGear - 1;
            safeSetCurrentGear(newGear);
            setLastShiftTime(now);
            return;
        }
    }, [currentGear, lastShiftTime, safeSetCurrentGear]);

    // 수동 변속 (순차적 변속 보장)
    const manualShift = useCallback((direction) => {
        const now = Date.now();
        if (now - lastShiftTime < GEAR_SYSTEM.MANUAL_SHIFT_DELAY) return; // 변속 쿨다운

        if (direction === 'up' && currentGear < 7) {
            const newGear = currentGear + 1;
            safeSetCurrentGear(newGear);
            console.log(`Manual shift up: ${currentGear === 0 ? 'N' : currentGear === 1 ? 'R' : (currentGear - 1).toString()} -> ${newGear === 0 ? 'N' : newGear === 1 ? 'R' : (newGear - 1).toString()}`);
            setLastShiftTime(now);
        } else if (direction === 'down' && currentGear > 0) {
            const newGear = currentGear - 1;
            safeSetCurrentGear(newGear);
            console.log(`Manual shift down: ${currentGear === 0 ? 'N' : currentGear === 1 ? 'R' : (currentGear - 1).toString()} -> ${newGear === 0 ? 'N' : newGear === 1 ? 'R' : (newGear - 1).toString()}`);
            setLastShiftTime(now);
        }
    }, [currentGear, lastShiftTime, safeSetCurrentGear]);

    // 기어 표시 업데이트 (N, R, 1-6단)
    useEffect(() => {
        if (currentGear === 0) {
            setGearDisplay('N'); // 중립
        } else if (currentGear === 1) {
            setGearDisplay('R'); // 후진
        } else if (currentGear < 0) {
            console.warn('Negative gear detected, resetting to N');
            setCurrentGear(0);
            setGearDisplay('N');
        } else if (currentGear >= 2 && currentGear <= 7) {
            setGearDisplay((currentGear - 1).toString()); // 1-6단 표시
        } else {
            console.warn('Invalid gear detected, resetting to N');
            setCurrentGear(0);
            setGearDisplay('N');
        }
        // console.log(`Gear display updated: ${currentGear} -> ${gearDisplay}`);
    }, [currentGear]);

    // 현실적인 RPM 업데이트 (프레임당 제한)
    const updateRPM = useCallback((speed, throttle) => {
        // === 기어 값 안전성 검사 (배열 기반 동적 범위로 교체) ===
        const maxGear = GEAR_SYSTEM.MAX_SPEED_PER_GEAR.length - 1;
        let safeGear = Math.min(Math.max(currentGear, 0), maxGear);

        if (safeGear !== currentGear) {
            console.warn(`Invalid gear corrected: ${currentGear} -> ${safeGear}`);
            // 무한 루프 방지를 위해 조건 확인 후 설정
            if (currentGear !== safeGear) {
                setCurrentGear(safeGear);
            }
        }

        const targetRPM = calculateRPM(speed, safeGear);

        if (throttle > 0) {
            // 가속 시 RPM 증가 (프레임당 제한)
            setEngineRPM(prev => {
                const rpmDiff = targetRPM - prev;
                const maxIncrease = GEAR_SYSTEM.RPM_INCREASE_PER_FRAME;
                const actualIncrease = Math.min(Math.abs(rpmDiff), maxIncrease);

                return Math.min(GEAR_SYSTEM.MAX_RPM, prev + actualIncrease);
            });
        } else {
            // 감속 시 RPM 감소 (천천히)
            setEngineRPM(prev => Math.max(GEAR_SYSTEM.IDLE_RPM,
                prev * GEAR_SYSTEM.RPM_DECAY_RATE));
        }

        // 디버깅: RPM 변화 추적 (로그 빈도 줄임)
        if (throttle > 0 && speed > 5.0) { // 로그 빈도 더 줄임
            // console.log(`RPM Update - Speed: ${speed.toFixed(1)}, Gear: ${safeGear}, Target: ${Math.round(targetRPM)}`);
        }
    }, [currentGear, calculateRPM]);

    // === getGearSpeedLimit: undefined 반환 방지 (개선) ===
    const getGearSpeedLimit = useCallback((gear) => {
        const maxGear = GEAR_SYSTEM.MAX_SPEED_PER_GEAR.length - 1;
        const safeGear = Math.min(Math.max(gear, 0), maxGear);
        const limit = GEAR_SYSTEM.MAX_SPEED_PER_GEAR[safeGear];

        if (typeof limit !== 'number' || isNaN(limit)) {
            console.warn('getGearSpeedLimit: invalid for gear', gear, '->', safeGear, 'fallback 85');
            return 85; // 더 현실적인 fallback 값
        }

        return limit;
    }, []);

    return {
        currentGear,
        engineRPM,
        isAutoShift,
        manualShiftMode,
        gearDisplay,
        autoShift,
        manualShift,
        updateRPM,
        setIsAutoShift,
        setManualShiftMode,
        setCurrentGear: safeSetCurrentGear, // 안전한 기어 변경 함수로 교체
        // 디버깅용: 현재 기어 상태 확인
        getCurrentGear: () => currentGear,
        getGearSpeedLimit // 추가 반환
    };
}

// === 커스텀 훅: 키 입력 관리 ===
function useCarControls() {
    const keys = useRef({ up: false, down: false, left: false, right: false, shiftUp: false, shiftDown: false });
    useEffect(() => {
        const keyDownHandler = (event) => {
            const key = event.key.toLowerCase();
            switch (key) {
                case 'arrowup': case 'w': case 'ㅈ': keys.current.up = true; break;
                case 'arrowdown': case 's': case 'ㄴ': keys.current.down = true; break;
                case 'arrowleft': case 'a': case 'ㅁ': keys.current.left = true; break;
                case 'arrowright': case 'd': case 'ㅇ': keys.current.right = true; break;
                case 'q': case 'ㅂ':
                    keys.current.shiftUp = true;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.shiftUp = true;
                    break; // 업시프트
                case 'e': case 'ㄷ':
                    keys.current.shiftDown = true;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.shiftDown = true;
                    break; // 다운시프트
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
                case 'q': case 'ㅂ':
                    keys.current.shiftUp = false;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.shiftUp = false;
                    break;
                case 'e': case 'ㄷ':
                    keys.current.shiftDown = false;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.shiftDown = false;
                    break;
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

// === 커스텀 훅: 차량 물리 처리 (AI 주행 포함) ===
function useCarPhysics({
    isRacing,
    carAngle,
    speed,
    setCarAngle,
    setSpeed,
    carPosition,
    setCarPosition,
    trackLayout,
    isDrawing,
    isAIDriving,
    idealLine,
    addPoint,
    onCheckpointPass,
    setPathDeviation,
    setCollisionEffect,
    gearSystem,
    setTireWear,
    setTireTemp
}) {
    const carAngleRef = useRef(carAngle);
    const speedRef = useRef(speed);
    useEffect(() => { carAngleRef.current = carAngle; }, [carAngle]);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    // 타이어 상태 ref
    const tireWearRef = useRef(0);
    const tireTempRef = useRef(90);
    useEffect(() => { tireWearRef.current = 0; tireTempRef.current = 90; }, [isRacing]);

    // 프레임 타이밍 관리
    const lastTimeRef = useRef(performance.now());

    useEffect(() => {
        if (!isRacing) return;
        let running = true;
        function frame() {
            if (!running) return;
            setCarPosition(prev => {
                let newAngle = carAngleRef.current;
                let newSpeed = speedRef.current;
                let throttle = 0, brake = 0, steering = 0;
                let newX, newY; // 위치 변수 명확히 선언

                // AI 자동 주행 로직
                if (isAIDriving && idealLine.length > 10) {
                    const targetPoint = findNextTargetPoint(prev, idealLine, 8);
                    if (targetPoint) {
                        // 목표점을 향해 조향
                        const targetAngle = Math.atan2(
                            targetPoint.x - prev.x,
                            -(targetPoint.y - prev.y)
                        ) * 180 / Math.PI;

                        // 부드러운 조향
                        let angleDiff = targetAngle - newAngle;
                        if (angleDiff > 180) angleDiff -= 360;
                        if (angleDiff < -180) angleDiff += 360;

                        newAngle += angleDiff * 0.1; // 부드러운 조향
                        steering = angleDiff * 0.05;

                        // AI 속도 제어
                        const deviation = calculatePathDeviation(prev, idealLine);
                        if (deviation < 2) {
                            newSpeed = Math.min(newSpeed + 0.5, 12); // 편차가 작으면 가속
                            throttle = 1; brake = 0;
                        } else {
                            newSpeed = Math.max(newSpeed - 0.3, 5); // 편차가 크면 감속
                            throttle = 0.3; brake = 0.7;
                        }

                        // AI 후진 처리 (필요시)
                        if (newSpeed < 0) {
                            newSpeed = Math.max(newSpeed, -6); // AI 후진 최고속도 제한
                        }
                    }
                } else {
                    // 수동 조향
                    if (window._carKeys?.left) newAngle -= 10;
                    if (window._carKeys?.right) newAngle += 10;

                    // 변속 시스템 처리
                    if (window._carKeys?.shiftUp) {
                        // console.log('Shift up key pressed');
                        gearSystem.manualShift('up');
                    }
                    if (window._carKeys?.shiftDown) {
                        // console.log('Shift down key pressed');
                        gearSystem.manualShift('down');
                    }

                    // === throttle, brake, steering 값 명확히 세팅 (기존 주석/코드 보존) ===
                    // 기존 throttle, brake, steering 선언은 유지
                    if (window._carKeys?.up) throttle = 1;
                    if (window._carKeys?.down) brake = 1;
                    if (window._carKeys?.left && !window._carKeys?.right) steering = -1;
                    if (window._carKeys?.right && !window._carKeys?.left) steering = 1;
                    if (window._carKeys?.left && window._carKeys?.right) steering = 0;

                    // 현실적인 가속/감속/후진 (기어별 속도 제한 적용)
                    let throttleForRPM = 0;
                    if (window._carKeys?.shiftUp) gearSystem.manualShift('up');
                    if (window._carKeys?.shiftDown) gearSystem.manualShift('down');
                    if (window._carKeys?.up) {
                        throttleForRPM = 1;
                        // 전진 가속 (기어별 속도 제한)
                        if (newSpeed >= 0) {
                            // === 기어 유효성 검사 및 동기화 (배열 기반 동적 범위로 교체) ===
                            const actualGear = gearSystem.getCurrentGear ? gearSystem.getCurrentGear() : gearSystem.currentGear;
                            const maxGear = GEAR_SYSTEM.MAX_SPEED_PER_GEAR.length - 1;
                            const currentGear = Math.min(Math.max(actualGear || 0, 0), maxGear);

                            // === getGearSpeedLimit undefined 방지 ===
                            const maxSpeedKMH = GEAR_SYSTEM.MAX_SPEED_PER_GEAR[currentGear];
                            if (typeof maxSpeedKMH !== 'number' || isNaN(maxSpeedKMH)) {
                                console.warn('getGearSpeedLimit: invalid for gear', currentGear, 'fallback 85');
                                maxSpeedKMH = 85;
                            }
                            const maxSpeedGame = maxSpeedKMH / 10; // KM/h를 게임 속도로 변환

                            // === 현실적인 기어비 시스템 (배열 기반 동적 범위로 교체) ===
                            const gearAccelerationRates = {
                                0: 0.00, // N(중립): 엔진 동력 전달 안됨
                                1: 0.20, // R(후진): 후진 가속
                                2: 0.30, // 1단: 가장 빠른 가속
                                3: 0.20, // 2단: 빠른 가속
                                4: 0.12, // 3단: 중간 가속
                                5: 0.08, // 4단: 느린 가속
                                6: 0.05, // 5단: 매우 느린 가속
                                7: 0.03  // 6단: 가장 느린 가속
                            };

                            // === 기어 가속도 범위 방어 ===
                            const safeGearForAccel = Math.min(Math.max(currentGear, 0), 7);
                            const acceleration = gearAccelerationRates[safeGearForAccel] || 0.00;

                            // 점진적 가속 (관성 고려)
                            const targetSpeed = maxSpeedGame;
                            const speedDiff = targetSpeed - newSpeed;
                            const actualAcceleration = Math.min(acceleration, Math.abs(speedDiff) * 0.1);

                            // 전진 가속
                            if (speedDiff > 0) {
                                newSpeed = Math.min(newSpeed + actualAcceleration, targetSpeed);
                            } else {
                                // 후진 중일 때 전진으로 전환 (기어를 N으로 변경)
                                // console.log('Shifting from reverse to neutral: R -> N');
                                if (gearSystem.currentGear === 1) gearSystem.setCurrentGear(0);
                                newSpeed = Math.min(newSpeed + 2.0, 0);
                            }

                            // 디버깅: 기어별 속도 제한 확인 (가속 중일 때만) - 실제 기어 상태 표시
                            if (newSpeed > 3.0) { // 로그 빈도 조정
                                const gearDisplay = currentGear === 0 ? 'N' : currentGear === 1 ? 'R' : (currentGear - 1).toString();
                                console.log(`Gear: ${gearDisplay}, Speed: ${newSpeed.toFixed(1)} (${(newSpeed * 10).toFixed(0)}km/h), Max: ${maxSpeedGame.toFixed(1)}, Accel: ${acceleration.toFixed(3)}, RPM: ${Math.round(gearSystem.engineRPM || 1000)}`);
                                // 기어 상태 동기화 확인
                                if (actualGear !== gearSystem.currentGear) {
                                    console.warn(`Gear sync issue: actualGear=${actualGear}, gearSystem.currentGear=${gearSystem.currentGear}`);
                                }
                            }

                            // 디버깅: 현실적인 변속 시스템 상태
                            // console.log(`Gear: ${currentGear}, Speed: ${newSpeed.toFixed(1)} (${(newSpeed * 10).toFixed(0)}km/h), Max: ${maxSpeedGame.toFixed(1)}, RPM: ${Math.round(gearSystem.engineRPM || 1000)}`);
                            if (speedDiff > 0) newSpeed = Math.min(newSpeed + actualAcceleration, targetSpeed);
                        } else {
                            if (gearSystem.currentGear === 1) gearSystem.setCurrentGear(0);
                            newSpeed = Math.min(newSpeed + 2.0, 0);
                        }
                    }
                    if (window._carKeys?.down) {
                        throttleForRPM = -1;
                        if (newSpeed > 0) {
                            // 전진 중일 때 점진적 감속
                            const deceleration = 0.1; // 점진적 감속
                            newSpeed = Math.max(newSpeed - deceleration, 0);
                        } else if (newSpeed === 0) {
                            // 정지 상태에서 후진 시작 (기어를 R로 변경)
                            if (gearSystem.currentGear !== 1) {
                                // console.log(`Shifting to reverse: ${gearSystem.currentGear} -> R`);
                                gearSystem.setCurrentGear(1); // R 기어로 변경
                            }
                            newSpeed = Math.max(newSpeed - 1.5, -8); // 후진 최고속도 -8
                        } else {
                            // 이미 후진 중일 때
                            newSpeed = Math.max(newSpeed - 1.5, -8);
                        }
                    }
                    if (!window._carKeys?.up && !window._carKeys?.down) {
                        // 자연 감속 (전진/후진 모두) - 점진적 감속
                        const naturalDeceleration = 0.02; // 매우 작은 자연 감속
                        if (newSpeed > 0) {
                            newSpeed = Math.max(newSpeed - naturalDeceleration, 0);
                        } else if (newSpeed < 0) {
                            newSpeed = Math.min(newSpeed + naturalDeceleration, 0);
                        }
                    }

                    // === RPM 업데이트 (유효성 검사 포함) ===
                    if (typeof newSpeed === 'number' && !isNaN(newSpeed)) {
                        gearSystem.updateRPM(newSpeed, throttleForRPM);

                        // 자동 변속 (자동 모드일 때)
                        if (gearSystem.isAutoShift && !gearSystem.manualShiftMode) {
                            gearSystem.autoShift(gearSystem.engineRPM, newSpeed, throttleForRPM);
                        }

                        // === 디버깅: 속도 0 현상 추적 ===
                        if (newSpeed > 0.1 && throttleForRPM > 0) {
                            console.log(`[Speed Debug] Speed: ${newSpeed.toFixed(2)}, Gear: ${gearSystem.currentGear}, RPM: ${Math.round(gearSystem.engineRPM)}, Throttle: ${throttleForRPM}`);
                        }
                    } else {
                        console.warn('Invalid speed value for RPM update:', newSpeed);
                    }
                }

                // === [고급 물리 효과 보정 코드] ===
                const now = performance.now();
                const dt = Math.max(0.008, Math.min(0.05, (now - lastTimeRef.current) / 1000)); // 8~50ms 제한
                lastTimeRef.current = now;

                // NaN/Infinity 추적 디버깅 로그
                if (!isFinite(newAngle) || isNaN(newAngle)) {
                    console.error('[NaN/Infinity] newAngle:', newAngle, 'prev.heading:', prev.heading, 'throttle:', throttle, 'brake:', brake, 'steering:', steering);
                }
                if (!isFinite(newSpeed) || isNaN(newSpeed)) {
                    console.error('[NaN/Infinity] newSpeed:', newSpeed, 'prev.speed:', speedRef.current, 'throttle:', throttle, 'brake:', brake, 'steering:', steering, 'dt:', dt);
                }
                let vx = Math.sin(newAngle * Math.PI / 180) * newSpeed;
                let vy = -Math.cos(newAngle * Math.PI / 180) * newSpeed;
                if (!isFinite(vx) || isNaN(vx)) {
                    console.error('[NaN/Infinity] vx:', vx, 'newAngle:', newAngle, 'newSpeed:', newSpeed);
                }
                if (!isFinite(vy) || isNaN(vy)) {
                    console.error('[NaN/Infinity] vy:', vy, 'newAngle:', newAngle, 'newSpeed:', newSpeed);
                }
                let carState = {
                    x: typeof prev.x === 'number' ? prev.x : 0,
                    y: typeof prev.y === 'number' ? prev.y : 0,
                    heading: newAngle,
                    tireWear: tireWearRef.current,
                    tireTemp: tireTempRef.current
                };
                let velocity = { x: vx, y: vy };
                // updateVehiclePhysics 호출 전후 입력값/출력값 디버깅
                console.log('[Physics Input] carState:', carState, 'input:', { throttle, brake, steering }, 'dt:', dt, 'velocity:', velocity);
                updateVehiclePhysics(carState, { throttle, brake, steering }, dt, velocity);
                console.log('[Physics Output] carState:', carState, 'velocity:', velocity);

                // updateVehiclePhysics 결과를 최종 상태로 반영 (항상 수치적으로 안전하게)
                if (typeof carState.x === 'number' && isFinite(carState.x)) newX = carState.x;
                else newX = prev.x;
                if (typeof carState.y === 'number' && isFinite(carState.y)) newY = carState.y;
                else newY = prev.y;
                if (typeof carState.heading === 'number' && isFinite(carState.heading)) newAngle = carState.heading;
                else newAngle = prev.heading || 0;
                if (
                    typeof velocity.x === 'number' && typeof velocity.y === 'number' &&
                    isFinite(velocity.x) && isFinite(velocity.y)
                ) {
                    newSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
                } else {
                    // newSpeed = 0; // ← 이 부분을
                    newSpeed = prev.speed; // 이전 정상값 유지
                }
                if (setTireWear) setTireWear(carState.tireWear);
                if (setTireTemp) setTireTemp(carState.tireTemp);
                tireWearRef.current = carState.tireWear;
                tireTempRef.current = carState.tireTemp;
                // === [고급 물리 효과 보정 코드 끝] ===
                // 아래 코드 공기저항, 다운포스, 타이어 마모/온도 등 고급 효과를 반영불가능
                // 아래 기존 위치/속도/각도 재정의 부분은 updateVehiclePhysics 결과를 덮어쓰지 않도록 주석 처리
                // const angleRad = (newAngle * Math.PI) / 180;
                // const newVelX = Math.sin(angleRad) * newSpeed * 0.8;
                // const newVelY = -Math.cos(angleRad) * newSpeed * 0.8;
                // const newX = prev.x + newVelX;
                // const newY = prev.y + newVelY;

                // 충돌 감지 및 처리
                const collision = calculateWallCollision(prev, { x: newX, y: newY }, newAngle, newSpeed, trackLayout);

                if (collision.collision) {
                    // 충돌 효과 표시
                    setCollisionEffect({ type: collision.type, active: true });
                    setTimeout(() => setCollisionEffect({ type: 'none', active: false }), 200);

                    // 충돌 후 상태 업데이트
                    setCarAngle(collision.angle);
                    setSpeed(collision.speed);
                    return collision.position;
                }

                // 아이디얼 라인 그리기
                if (isDrawing) addPoint({ x: newX, y: newY });

                // 경로 편차 계산
                if (idealLine.length > 0) {
                    const deviation = calculatePathDeviation({ x: newX, y: newY }, idealLine);
                    setPathDeviation(deviation);
                }

                setCarAngle(newAngle);
                setSpeed(newSpeed);
                onCheckpointPass({ x: newX, y: newY });
                return { x: newX, y: newY };
            });
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        return () => { running = false; };
    }, [isRacing, isDrawing, isAIDriving, idealLine, trackLayout, addPoint, setCarAngle, setSpeed, setCarPosition, onCheckpointPass, setPathDeviation, setCollisionEffect, gearSystem]);
}

const F1RacingGame = () => {
    // 1. 커스텀 훅/상태 선언을 최상단에!
    const gearSystem = useGearSystem();

    const [trackLayout] = useState(createTrackLayout());
    const trackLayoutRef = useRef(trackLayout);

    // 시작 위치가 도로인지 확인
    // console.log('Start cell type:', trackLayout[28][100]); // 0이어야 도로
    // console.log('Track layout at start position:', trackLayout[28][100]);
    // console.log('Current car position:', { x: 100, y: 28 });
    // console.log('Is road cell:', isRoadCell(trackLayout[28][100]));

    // 차량 시작 위치를 스타트/피니시 라인 위로 정확히 설정
    const cx = 200 / 2, cy = 120 / 2, outerR = 55;
    const startFinishY = Math.floor(cy);
    const startX = Math.floor(cx + outerR) - 5;

    // 도로 셀인지 확인하고 시작 위치 조정
    const getValidStartPosition = () => {
        // 스타트/피니시 라인 근처에서 도로 셀 찾기
        for (let offset = -3; offset <= 3; offset++) {
            const testX = startX + offset;
            const testY = startFinishY;
            if (testX >= 0 && testX < GRID_WIDTH && testY >= 0 && testY < GRID_HEIGHT) {
                if (isRoadCell(trackLayout[testY][testX])) {
                    // console.log(`Valid start position found: ${testX}, ${testY}`);
                    return { x: testX, y: testY };
                }
            }
        }
        // 기본 위치 반환
        return { x: startX, y: startFinishY };
    };

    const [carPosition, setCarPosition] = useState(getValidStartPosition());
    const [carAngle, setCarAngle] = useState(180); // 왼쪽(서쪽) 방향
    const [speed, setSpeed] = useState(0);
    const [isRacing, setIsRacing] = useState(false);
    const [currentLapTime, setCurrentLapTime] = useState(0);
    const [bestLapTime, setBestLapTime] = useState(null);
    const [lapStartTime, setLapStartTime] = useState(null);
    const [hasPassedStart, setHasPassedStart] = useState(false);
    const [lapCount, setLapCount] = useState(0);
    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [collisionEffect, setCollisionEffect] = useState({ type: 'none', active: false });
    const [tireWear, setTireWear] = useState(0);
    const [tireTemp, setTireTemp] = useState(90);
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

    // 아이디얼 라인 핸들러 (확장된 기능 포함)
    const {
        idealLine,
        isDrawing,
        isAIDriving,
        pathDeviation,
        idealLineTime,
        startDrawing,
        stopDrawing,
        resetLine,
        addPoint,
        toggleAIDriving,
        setPathDeviation,
        setIdealLineTime
    } = useIdealLine();
    const addPointRef = useRef(addPoint);

    // addPoint ref 업데이트
    useEffect(() => { addPointRef.current = addPoint; }, [addPoint]);

    // START RACE: 레이스 시작 시 상태 초기화 (기어 변경은 useEffect에서 처리)
    const startRace = useCallback(() => {
        setIsRacing(true); // isRacing이 true가 되면 useEffect에서 1단 자동 변속
        setCarPosition(getValidStartPosition());
        setCarAngle(180);
        setSpeed(0);
        setCurrentLapTime(0);
        setLapStartTime(null);
        setHasPassedStart(false);
        setLapCount(0);
        setPathDeviation(0);
        setCollisionEffect({ type: 'none', active: false });
        // gearSystem.setCurrentGear(2); // (이제는 useEffect에서 처리)
    }, [getValidStartPosition]);

    // === [자동 변속 개선: 레이스 시작 시 1단 자동 변속] ===
    useEffect(() => {
        if (isRacing && gearSystem && gearSystem.setCurrentGear) {
            gearSystem.setCurrentGear(2); // 1단으로 자동 변속
        }
    }, [isRacing, gearSystem]);

    const stopRace = useCallback(() => {
        setIsRacing(false);
        setSpeed(0);
        setLapStartTime(null);
        if (isAIDriving) {
            toggleAIDriving(); // AI 주행 중지
        }
    }, [isAIDriving, toggleAIDriving]);

    // 체크포인트 제거
    const checkpoints = [];
    // 체크포인트 4개 (가로선만, 트랙 내 y값만 다르게)
    const CHECKPOINT_RADIUS = 3; // 체크포인트 판정 반경(작게)
    const [checkpointIndex, setCheckpointIndex] = useState(0); // 다음 통과해야 할 체크포인트
    const [passedAllCheckpoints, setPassedAllCheckpoints] = useState(false);

    // 키 입력 커스텀 훅
    const keys = useCarControls();
    // window에 키 상태 공유(물리 훅에서 접근)
    useEffect(() => {
        window._carKeys = keys.current;
    });

    // 디버깅: 변속 시스템 초기화 확인
    useEffect(() => {
        // console.log('Gear System initialized:', {
        //     currentGear: gearSystem.currentGear,
        //     engineRPM: gearSystem.engineRPM,
        //     isAutoShift: gearSystem.isAutoShift,
        //     gearDisplay: gearSystem.gearDisplay
        // });
    }, []); // 빈 의존성 배열로 변경하여 무한 루프 방지

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

                // 아이디얼 라인 기준 랩타임 설정 (첫 번째 완주 시)
                if (idealLine.length > 10 && !idealLineTime) {
                    setIdealLineTime(lapTime);
                }

                setLapStartTime(Date.now());
                setHasPassedStart(false);
                setPassedAllCheckpoints(false);
            } else if (!hasPassedStart) {
                setHasPassedStart(true);
                if (!lapStartTime) setLapStartTime(Date.now());
            }
        }
    }, [carPosition, isRacing, passedAllCheckpoints, hasPassedStart, lapStartTime, bestLapTime, trackLayout, idealLine.length, idealLineTime, setIdealLineTime]);

    // 차량 물리 커스텀 훅 (AI 주행 포함)
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
        isAIDriving,
        idealLine,
        addPoint,
        onCheckpointPass,
        setPathDeviation,
        setCollisionEffect,
        gearSystem,
        setTireWear,
        setTireTemp
    });

    // 키보드 입력 처리는 useEffect 내부에서 직접 처리

    useEffect(() => {
        // console.log('Adding keyboard event listeners'); // 디버깅 로그 추가

        const keyDownHandler = (event) => {
            const key = event.key.toLowerCase();
            // console.log('=== KEY DOWN EVENT ===');
            // console.log('Key pressed:', key, 'isRacing:', isRacing);
            // console.log('Event target:', event.target);
            // console.log('Current keysRef before:', keysRef.current);

            switch (key) {
                case 'arrowup': case 'w': case 'ㅈ':
                    keysRef.current.up = true;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.up = true;
                    break;
                case 'arrowdown': case 's': case 'ㄴ':
                    keysRef.current.down = true;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.down = true;
                    break;
                case 'arrowleft': case 'a': case 'ㅁ':
                    keysRef.current.left = true;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.left = true;
                    break;
                case 'arrowright': case 'd': case 'ㅇ':
                    keysRef.current.right = true;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.right = true;
                    break;
                case 'q': case 'ㅂ':
                    keysRef.current.shiftUp = true;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.shiftUp = true;
                    //console.log('Q/ㅂ key pressed (shift up), keysRef after:', keysRef.current, 'window._carKeys:', window._carKeys);
                    break;
                case 'e': case 'ㄷ':
                    keysRef.current.shiftDown = true;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.shiftDown = true;
                    //console.log('E/ㄷ key pressed (shift down), keysRef after:', keysRef.current, 'window._carKeys:', window._carKeys);
                    break;
                case ' ':
                    event.preventDefault();
                    if (!isRacing) startRace();
                    break;
                case 'i':
                    isDrawing ? stopDrawing() : startDrawing();
                    break;
                case 'o': // AI 자동 주행 토글
                    if (idealLine.length > 10) {
                        toggleAIDriving();
                    }
                    break;
                default: break;
            }
        };

        const keyUpHandler = (event) => {
            const key = event.key.toLowerCase();
            switch (key) {
                case 'arrowup': case 'w': case 'ㅈ':
                    keysRef.current.up = false;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.up = false;
                    break;
                case 'arrowdown': case 's': case 'ㄴ':
                    keysRef.current.down = false;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.down = false;
                    break;
                case 'arrowleft': case 'a': case 'ㅁ':
                    keysRef.current.left = false;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.left = false;
                    break;
                case 'arrowright': case 'd': case 'ㅇ':
                    keysRef.current.right = false;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.right = false;
                    break;
                case 'q': case 'ㅂ':
                    keysRef.current.shiftUp = false;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.shiftUp = false;
                    break;
                case 'e': case 'ㄷ':
                    keysRef.current.shiftDown = false;
                    // window._carKeys와 동기화
                    if (window._carKeys) window._carKeys.shiftDown = false;
                    break;
                default: break;
            }
        };

        window.addEventListener('keydown', keyDownHandler);
        window.addEventListener('keyup', keyUpHandler);

        return () => {
            // console.log('Removing keyboard event listeners');
            window.removeEventListener('keydown', keyDownHandler);
            window.removeEventListener('keyup', keyUpHandler);
        };
    }, [isRacing, isDrawing, idealLine.length, startRace, toggleAIDriving]);

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
            {/* 상단: 차량 주행 관련 정보 */}
            <div className="flex gap-4 mb-4 text-sm">
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Current Lap</div>
                    <div className="text-lg font-mono">{formatTime(currentLapTime)}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Best Lap</div>
                    <div className="text-lg font-mono text-yellow-400">{bestLapTime ? formatTime(bestLapTime) : '--:--'}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Ideal Line Time</div>
                    <div className="text-lg font-mono text-cyan-400">{idealLineTime ? formatTime(idealLineTime) : '--:--'}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Laps</div>
                    <div className="text-lg font-mono">{lapCount}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Speed</div>
                    <div className={`text-lg font-mono ${speed < 0 ? 'text-red-400' : speed > 0 ? 'text-green-400' : 'text-white'}`}>{speed >= 0 ? `${speed.toFixed(1)} (${(speed * 10).toFixed(0)}km/h)` : `R ${Math.abs(speed).toFixed(1)}`}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">RPM</div>
                    <div className={`text-lg font-mono ${gearSystem.engineRPM > 5000 ? 'text-red-500' : gearSystem.engineRPM > 4000 ? 'text-yellow-400' : 'text-green-400'}`}>{Math.round(gearSystem.engineRPM)}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Gear</div>
                    <div className="text-lg font-mono text-blue-400">{gearSystem.gearDisplay}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded">
                    <div className="text-gray-300">Shift Mode</div>
                    <div className={`text-lg font-mono ${gearSystem.isAutoShift ? 'text-purple-400' : 'text-orange-400'}`}>{gearSystem.isAutoShift ? 'AUTO' : 'MANUAL'}</div>
                </div>
            </div>
            {/* 우측: 경로/AI/타이어 관련 정보 */}
            <div
                className="fixed right-10 top-1/2 flex flex-col gap-2 z-50"
                style={{ transform: 'translateY(-50%)', maxWidth: 180 }}
            >
                <div className="bg-gray-800 p-2 rounded min-w-[140px]">
                    <div className="text-gray-300">Path Deviation</div>
                    <div className="text-lg font-mono text-orange-400">{pathDeviation.toFixed(1)}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded min-w-[140px]">
                    <div className="text-gray-300">Ideal Line</div>
                    <div className="text-lg font-mono">{isDrawing ? 'ON' : 'OFF'}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded min-w-[140px]">
                    <div className="text-gray-300">AI Driving</div>
                    <div className="text-lg font-mono text-green-400">{isAIDriving ? 'ON' : 'OFF'}</div>
                </div>
                <div className="bg-gray-800 p-2 rounded min-w-[140px]">
                    <div className="text-gray-300">Tire Wear</div>
                    <div className="text-lg font-mono text-pink-400">{(tireWear * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-gray-800 p-2 rounded min-w-[140px]">
                    <div className="text-gray-300">Tire Temp</div>
                    <div className="text-lg font-mono text-yellow-300">{tireTemp.toFixed(1)}°C</div>
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

                                // AI 주행 중일 때 목표점 표시
                                if (isAIDriving && idealLine.length > 0) {
                                    const targetPoint = findNextTargetPoint(carPosition, idealLine, 8);
                                    if (targetPoint) {
                                        ctx.beginPath();
                                        ctx.arc(targetPoint.x * GRID_SIZE, targetPoint.y * GRID_SIZE, 8, 0, 2 * Math.PI);
                                        ctx.fillStyle = 'rgba(255,255,0,0.8)';
                                        ctx.fill();
                                        ctx.strokeStyle = 'rgba(255,255,0,1)';
                                        ctx.lineWidth = 2;
                                        ctx.stroke();
                                    }
                                }
                            }
                        }}
                        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 3 }}
                    />
                    {/* F1 차량 */}
                    <div
                        className={`absolute bg-red-500 rounded-sm flex items-center justify-center text-white text-lg font-bold transition-transform duration-75 ${collisionEffect.active ? 'animate-pulse bg-yellow-500' : ''
                            }`}
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
                        {isAIDriving ? '🤖' : '🐷'}
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
                    <button
                        onClick={toggleAIDriving}
                        disabled={idealLine.length < 10}
                        className={`px-4 py-2 rounded font-bold ${isAIDriving ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} ${idealLine.length < 10 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isAIDriving ? 'Stop AI' : 'Start AI'} (O)
                    </button>
                    <button
                        onClick={() => gearSystem.setIsAutoShift(!gearSystem.isAutoShift)}
                        className={`px-4 py-2 rounded font-bold ${gearSystem.isAutoShift ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                        {gearSystem.isAutoShift ? 'Auto Shift' : 'Manual Shift'}
                    </button>
                </div>
                <div className="text-sm text-gray-400 grid grid-cols-2 gap-4">
                    <div>
                        <div className="font-bold mb-1">🏎️ Controls:</div>
                        <div>W/↑: Accelerate</div>
                        <div>S/↓: Brake/Reverse</div>
                        <div>A/←: Turn Left</div>
                        <div>D/→: Turn Right</div>
                        <div>Q: Shift Up</div>
                        <div>E: Shift Down</div>
                    </div>
                    <div>
                        <div className="font-bold mb-1">🎯 Features:</div>
                        <div>I: Toggle Ideal Line</div>
                        <div>O: Toggle AI Driving</div>
                        <div>Space: Start/Restart</div>
                        <div>🔴 Red: Start/Finish Line</div>
                        <div>🔵 Blue: Pit Lane</div>
                        <div>💥 Wall Collision: Bounce Physics</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default F1RacingGame;