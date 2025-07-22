import { isRoadCell } from '../track/trackLayout';

// 차량 물리, 충돌, 변속 등 엔진 관련 함수/클래스 모듈

/**
 * 트랙 셀의 법선 벡터 계산 (8방향 평균)
 * @param {number} x - 셀 x좌표
 * @param {number} y - 셀 y좌표
 * @param {number[][]} trackLayout - 트랙 배열
 * @returns {{x: number, y: number}} - 단위 벡터(법선)
 */
function getSurfaceNormal(x, y, trackLayout) {
    const dirs = [
        [0, -1], [1, -1], [1, 0], [1, 1],
        [0, 1], [-1, 1], [-1, 0], [-1, -1]
    ];
    let nx = 0, ny = 0, count = 0;
    for (const [dx, dy] of dirs) {
        const nx_ = x + dx, ny_ = y + dy;
        if (nx_ >= 0 && nx_ < 200 && ny_ >= 0 && ny_ < 120) {
            if (!isRoadCell(trackLayout[ny_][nx_])) {
                nx += dx;
                ny += dy;
                count++;
            }
        }
    }
    if (count === 0) return { x: 0, y: 0 };
    const len = Math.sqrt(nx * nx + ny * ny);
    return { x: nx / len, y: ny / len };
}

/**
 * 현실적인 반사각 계산 (법선 벡터 기반)
 * @param {number} carAngle - 차량 각도(도)
 * @param {{x: number, y: number}} collisionPos - 충돌 위치
 * @param {{x: number, y: number}} prevPos - 이전 위치
 * @param {number[][]} trackLayout - 트랙 배열
 * @returns {number} - 반사 각도(도)
 */
export function calculateReflectionAngle(carAngle, collisionPos, prevPos, trackLayout) {
    // 차량 진행 벡터
    const vx = collisionPos.x - prevPos.x;
    const vy = collisionPos.y - prevPos.y;
    // 충돌 셀의 법선 벡터
    const gridX = Math.floor(collisionPos.x);
    const gridY = Math.floor(collisionPos.y);
    const normal = getSurfaceNormal(gridX, gridY, trackLayout);
    // 벡터 반사 공식: r = v - 2(v·n)n
    const dot = vx * normal.x + vy * normal.y;
    const rx = vx - 2 * dot * normal.x;
    const ry = vy - 2 * dot * normal.y;
    // 반사 벡터 → 각도
    const reflectionAngle = Math.atan2(ry, rx) * 180 / Math.PI;
    return reflectionAngle;
}

/**
 * 벽/오프로드 충돌 감지 및 처리
 * @returns {object} 충돌 정보
 */
export function calculateWallCollision(currentPos, newPos, carAngle, speed, trackLayout) {
    const gridX = Math.floor(newPos.x);
    const gridY = Math.floor(newPos.y);
    if (gridX < 0 || gridX >= 200 || gridY < 0 || gridY >= 120) {
        return {
            collision: true,
            position: currentPos,
            angle: carAngle + 180,
            speed: Math.max(speed * 0.1, 0),
            type: 'boundary'
        };
    }
    if (!isRoadCell(trackLayout[gridY][gridX])) {
        const nearestRoad = findNearestRoadPoint(newPos, trackLayout);
        if (nearestRoad === null) {
            console.warn("No nearest road point found for collision correction. Using current position as fallback.");
            return {
                collision: true,
                position: currentPos,
                angle: calculateReflectionAngle(carAngle, newPos, currentPos, trackLayout),
                speed: Math.max(speed * 0.2, 0),
                type: 'wall'
            };
        }
        return {
            collision: true,
            position: nearestRoad,
            angle: calculateReflectionAngle(carAngle, newPos, currentPos, trackLayout),
            speed: Math.max(speed * 0.2, 0),
            type: 'wall'
        };
    }
    return { collision: false };
}

/**
 * 충돌 후 가장 가까운 도로 셀 찾기
 */
export function findNearestRoadPoint(pos, trackLayout) {
    const searchRadius = 5;
    for (let radius = 1; radius <= searchRadius; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = Math.floor(pos.x) + dx;
                const y = Math.floor(pos.y) + dy;
                if (x >= 0 && x < 200 && y >= 0 && y < 120) {
                    if (isRoadCell(trackLayout[y][x])) {
                        return { x: x + 0.5, y: y + 0.5 };
                    }
                }
            }
        }
    }
    return null;
}

/**
 * 차량 동역학(가속/제동/마찰/슬립/공기저항/다운포스/타이어 마모 등) 업데이트
 * @param {object} state - {x, y, heading, tireWear, tireTemp}
 * @param {object} input - {throttle, brake, steering}
 * @param {number} dt - 시간 간격(초)
 * @param {object} [velocityObj] - {x, y} 속도 벡터(외부에서 관리 권장)
 * @returns {object} - {x, y} 속도 벡터(업데이트된 값)
 */
export function updateVehiclePhysics(state, input, dt, velocityObj = { x: 0, y: 0 }) {
    // === 입력값 로그 ===
    console.log('[updateVehiclePhysics] 입력값:', {
        state: { ...state },
        input: { ...input },
        dt,
        velocityObj: { ...velocityObj }
    });

    // 파라미터 (빠른 가속/빠른 감속)
    const maxAccel = 0.7; // 최대 가속 (기존 0.2 → 0.7, 대폭 상승)
    const maxBrake = 1.2; // 최대 제동 (기존 0.3 → 1.2, 대폭 상승)
    const friction = 0.003; // 마찰 계수(기존 0.003 → 0.04, 대폭 상승)
    const airDragCoeff = 0.0007; // 공기저항 계수(기존 0.0007 → 0.02, 대폭 상승)
    const downforceCoeff = 0.0003; // 다운포스 계수(기존 0.0003 → 0.01, 대폭 상승)
    const velocityFrameFactor = 1.5; // 프레임 보정 계수(기존 1.0 → 1.5, 대폭 상승)
    const tireWearRate = 0.00005; // 타이어 마모율 (유지)
    const tireTempIncrease = 0.02; // 타이어 온도 상승율 (유지)
    const tireTempCool = 0.01; // 타이어 냉각율 (유지)
    const tireGripLossPerWear = 0.3; // 마모에 따른 그립 손실(최대) (유지)
    const tireGripLossPerTemp = 0.2; // 과열에 따른 그립 손실(최대) (유지)
    const optimalTireTemp = 90; // 최적 타이어 온도(°C) (유지)
    const maxTireTemp = 120; // 최대 타이어 온도(°C) (유지)

    // === 기어 정보 추출 (없으면 N=0, R=1, 1~6=2~7) ===
    // state.gear 또는 input.gear에서 가져오고, 없으면 N(0)로 간주
    const gear = (typeof state.gear === 'number') ? state.gear : (typeof input.gear === 'number' ? input.gear : 0);
    const isReverse = gear === 1;
    const maxForwardSpeed = 20; // 게임 단위(200km/h)
    const maxReverseSpeed = 8;  // 후진 최대 속도(80km/h)
    const maxVelocity = 30;     // velocityObj 각 축 최대값(비정상 폭증 방지)
    const minAccel = -1.2;

    // 가속/제동
    let accel = 0;
    if (input.throttle) accel += maxAccel;
    if (input.brake) accel -= maxBrake;

    // === 브레이크 입력 시 속도 0 이하로 감소 방지 ===
    // (전진 기어일 때만, 후진 기어는 예외)
    let vx = velocityObj.x;
    let vy = velocityObj.y;
    let speed = Math.sqrt(vx * vx + vy * vy);
    if (!isReverse && input.brake && speed <= 0.1) {
        accel = 0; // 속도가 0 이하일 때 브레이크로 더 감소시키지 않음
        vx = 0;
        vy = 0;
    }

    // === accel 상한/하한 적용 ===
    if (accel > maxAccel) accel = maxAccel;
    if (accel < minAccel) accel = minAccel;

    // === 중간값 로그: accel ===
    if (!isFinite(accel)) console.warn('[NaN/Infinity] accel:', accel, input, state);
    console.log('[updateVehiclePhysics] 중간(accel):', { accel });

    // 속도 벡터 업데이트
    vx += Math.sin(state.heading * Math.PI / 180) * accel * dt;
    vy += -Math.cos(state.heading * Math.PI / 180) * accel * dt;

    // === velocityObj 상한/하한 적용 ===
    if (vx > maxVelocity) vx = maxVelocity;
    if (vx < -maxVelocity) vx = -maxVelocity;
    if (vy > maxVelocity) vy = maxVelocity;
    if (vy < -maxVelocity) vy = -maxVelocity;

    velocityObj.x = vx;
    velocityObj.y = vy;

    // === 중간값 로그: velocity after accel ===
    if (!isFinite(velocityObj.x) || !isFinite(velocityObj.y)) console.warn('[NaN/Infinity] velocity after accel:', velocityObj, state, accel, dt);
    console.log('[updateVehiclePhysics] 중간(velocity after accel):', { velocityObj: { ...velocityObj } });

    // === 프레임 보정 계수 적용 (빠른 이동) ===
    velocityObj.x *= velocityFrameFactor;
    velocityObj.y *= velocityFrameFactor;

    // === velocityObj 상한/하한 재적용 ===
    if (velocityObj.x > maxVelocity) velocityObj.x = maxVelocity;
    if (velocityObj.x < -maxVelocity) velocityObj.x = -maxVelocity;
    if (velocityObj.y > maxVelocity) velocityObj.y = maxVelocity;
    if (velocityObj.y < -maxVelocity) velocityObj.y = -maxVelocity;

    // === 중간값 로그: velocity after frame factor ===
    if (!isFinite(velocityObj.x) || !isFinite(velocityObj.y)) console.warn('[NaN/Infinity] velocity after frame factor:', velocityObj, velocityFrameFactor);
    console.log('[updateVehiclePhysics] 중간(velocity after frame factor):', { velocityObj: { ...velocityObj } });

    // 속도/방향
    speed = Math.sqrt(velocityObj.x ** 2 + velocityObj.y ** 2);
    const direction = Math.atan2(velocityObj.y, velocityObj.x);

    // === 전진/후진 속도 제한 ===
    if (isReverse) {
        if (speed > maxReverseSpeed) {
            // 후진 기어에서만 음수 속도 허용, 최대 후진 속도 제한
            const scale = maxReverseSpeed / speed;
            velocityObj.x *= scale;
            velocityObj.y *= scale;
            speed = maxReverseSpeed;
        }
    } else {
        // 전진 기어에서는 음수 속도 불허, 최대 전진 속도 제한
        if (speed < 0) speed = 0;
        if (speed > maxForwardSpeed) {
            const scale = maxForwardSpeed / speed;
            velocityObj.x *= scale;
            velocityObj.y *= scale;
            speed = maxForwardSpeed;
        }
        // 음수 속도 방지
        if (velocityObj.x < 0) velocityObj.x = 0;
        if (velocityObj.y < 0) velocityObj.y = 0;
    }

    // === 중간값 로그: speed, direction ===
    if (!isFinite(speed)) console.warn('[NaN/Infinity] speed:', speed, velocityObj);
    if (!isFinite(direction)) console.warn('[NaN/Infinity] direction:', direction, velocityObj);
    console.log('[updateVehiclePhysics] 중간(speed/direction):', { speed, direction });

    // 공기저항(속도의 제곱에 비례)
    const drag = airDragCoeff * speed * speed;
    velocityObj.x -= Math.cos(direction) * drag * dt;
    velocityObj.y -= Math.sin(direction) * drag * dt;

    // === 중간값 로그: drag ===
    if (!isFinite(drag)) console.warn('[NaN/Infinity] drag:', drag, speed, airDragCoeff);
    if (!isFinite(velocityObj.x) || !isFinite(velocityObj.y)) console.warn('[NaN/Infinity] velocity after drag:', velocityObj, drag, dt);
    console.log('[updateVehiclePhysics] 중간(drag):', { drag, velocityObj: { ...velocityObj } });

    // 다운포스(속도에 비례, 접지력 증가)
    const downforce = downforceCoeff * speed;
    let effectiveFriction = friction + downforce;

    // === 중간값 로그: downforce, effectiveFriction ===
    if (!isFinite(downforce)) console.warn('[NaN/Infinity] downforce:', downforce, speed, downforceCoeff);
    if (!isFinite(effectiveFriction)) console.warn('[NaN/Infinity] effectiveFriction:', effectiveFriction, friction, downforce);
    console.log('[updateVehiclePhysics] 중간(downforce/effectiveFriction):', { downforce, effectiveFriction });

    // 타이어 마모/온도
    if (state.tireWear === undefined) state.tireWear = 0;
    if (state.tireTemp === undefined) state.tireTemp = optimalTireTemp;
    // 마모: 속도, 조향, 가속에 따라 증가
    state.tireWear += (Math.abs(input.steering) + Math.abs(accel) + speed * 0.01) * tireWearRate * dt;
    state.tireWear = Math.min(state.tireWear, 1.0); // 0~1
    // 온도: 속도, 마찰, 가속에 따라 증가, 주행 없으면 냉각
    if (speed > 1) {
        state.tireTemp += (Math.abs(accel) + Math.abs(input.steering) + speed * 0.05) * tireTempIncrease * dt;
    } else {
        state.tireTemp -= tireTempCool * dt;
    }
    state.tireTemp = Math.max(20, Math.min(state.tireTemp, maxTireTemp));

    // 타이어 마모/온도에 따른 그립 손실
    let gripLossWear = tireGripLossPerWear * state.tireWear;
    if (!isFinite(gripLossWear)) gripLossWear = 0;
    let gripLossTemp = 0;
    if (state.tireTemp > optimalTireTemp) {
        const tempFactor = (state.tireTemp - optimalTireTemp) / (maxTireTemp - optimalTireTemp);
        gripLossTemp = tireGripLossPerTemp * tempFactor;
        if (!isFinite(gripLossTemp)) gripLossTemp = 0;
    }
    effectiveFriction -= (gripLossWear + gripLossTemp);
    if (!isFinite(effectiveFriction) || effectiveFriction < 0.005) effectiveFriction = 0.005;

    // === 중간값 로그: gripLossWear, gripLossTemp, effectiveFriction ===
    console.log('[updateVehiclePhysics] 중간(gripLoss):', { gripLossWear, gripLossTemp, effectiveFriction });

    // 마찰력 적용
    velocityObj.x *= (1 - effectiveFriction);
    velocityObj.y *= (1 - effectiveFriction);

    // === 중간값 로그: velocity after friction ===
    if (!isFinite(velocityObj.x) || !isFinite(velocityObj.y)) console.warn('[NaN/Infinity] velocity after friction:', velocityObj, effectiveFriction);
    console.log('[updateVehiclePhysics] 중간(velocity after friction):', { velocityObj: { ...velocityObj } });

    // 코너링/슬립(마모/온도 반영)
    const maxGrip = 0.15 + 0.05 * Math.max(0, 1 - speed / 20) - gripLossWear - gripLossTemp;
    if (!isFinite(maxGrip)) console.warn('[NaN/Infinity] maxGrip:', maxGrip, speed, gripLossWear, gripLossTemp);
    if (Math.abs(input.steering) > maxGrip) {
        // 슬립 발생: 진행 방향과 heading이 다르게
        state.heading += input.steering * 0.5; // 미끄러짐 효과
    } else {
        state.heading += input.steering;
    }
    if (!isFinite(state.heading)) console.warn('[NaN/Infinity] heading:', state.heading, input.steering);
    console.log('[updateVehiclePhysics] 중간(heading):', { heading: state.heading });

    // 위치 업데이트
    state.x += velocityObj.x * dt;
    state.y += velocityObj.y * dt;
    if (!isFinite(state.x) || !isFinite(state.y)) console.warn('[NaN/Infinity] state.x/y:', state.x, state.y, velocityObj, dt);
    console.log('[updateVehiclePhysics] 중간(position):', { x: state.x, y: state.y });

    if (!isFinite(velocityObj.x)) velocityObj.x = 0;
    if (!isFinite(velocityObj.y)) velocityObj.y = 0;

    // === 출력값 로그 ===
    console.log('[updateVehiclePhysics] 출력값:', {
        state: { ...state },
        velocityObj: { ...velocityObj }
    });

    return { ...velocityObj };
}

// 사용 예시 (useCarPhysics 등에서):
// let velocity = { x: 0, y: 0 };
// let carState = { x, y, heading, tireWear: 0, tireTemp: 90 };
// updateVehiclePhysics(carState, input, dt, velocity);