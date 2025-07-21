# F1 레이싱 게임 AI 시스템 개발 계획

## 🎯 전체 목표
AI가 실제 F1 서킷을 빠르고 정확하게 주행할 수 있는 시스템을 점진적으로 학습/최적화하도록 만든다.

# F1 레이싱 게임 AI 개발 계획서

## 1. 목표

AI가 주어진 트랙에서 가장 빠른 랩타임을 기록할 수 있는 최적의 주행 경로(아이디얼 라인)를 스스로 찾아내도록 한다.

## 2. 핵심 알고리즘: A\* (A-Star)

- **선정 이유:** A\* 알고리즘은 목표 지점까지의 최단 경로를 효율적으로 찾는 데 검증된 강력한 알고리즘이다. 게임 AI의 길 찾기(Pathfinding) 문제에 매우 적합하며, '시간'이라는 비용을 기준으로 랩타임 최적화에 직접 적용할 수 있다.
- **동작 원리:** `f(n) = g(n) + h(n)`
    - `g(n)`: 시작점에서 현재 위치(n)까지의 실제 비용 (누적 주행 시간)
    - `h(n)`: 현재 위치(n)에서 도착점까지의 예상 비용 (추정 남은 시간)
    - `f(n)`: 총 예상 비용. 이 값이 가장 작은 노드를 우선적으로 탐색하여 최적 경로를 찾는다.

## 3. 개발 단계

### 1단계: 문제 모델링 및 데이터 구조 정의

- **그래프(Graph) 표현:**
    - **노드(Node):** 트랙의 주행 가능한 모든 셀(`trackLayout`에서 값이 1 또는 2인 셀)을 노드로 정의한다. 각 노드는 `(x, y)` 좌표 외에 다음 정보를 포함할 수 있다: `{ x, y, g, h, f, parent }`.
    - **간선(Edge):** 한 노드에서 인접한 8방향(또는 4방향)의 주행 가능한 노드로의 이동을 간선으로 정의한다.
- **비용(Cost) 계산 함수 구현:**
    - `calculateCost(fromNode, toNode)` 함수를 개발한다.
    - **핵심:** 비용은 단순한 거리가 아닌 **'시간'**이어야 한다.
    - `시간 = 거리 / 속도`
    - **속도 결정 요인:**
        1.  **회전 각도:** 이전 이동 방향과 현재 이동 방향 사이의 각도 변화가 클수록(급커브) 속도는 크게 감소해야 한다.
        2.  **직선 주행:** 각도 변화가 거의 없으면(직선) 최대 속도를 유지할 수 있다.
    - 이 함수는 두 노드 사이를 이동하는 데 걸리는 시간을 반환한다.

### 2단계: A\* 알고리즘 구현

- `findOptimalPath(startNode, endNode, trackLayout)` 함수를 구현한다.
- **필요 데이터 구조:**
    - `openList`: 탐색할 노드들의 목록. `f` 비용이 가장 낮은 노드가 항상 맨 앞에 오도록 우선순위 큐(Priority Queue)로 구현하는 것이 효율적이다.
    - `closedList`: 이미 탐색이 완료된 노드들의 목록. 다시 방문하지 않기 위해 사용한다.
- **알고리즘 로직:**
    1.  `openList`에 시작 노드를 추가한다.
    2.  `openList`가 비어있지 않은 동안 반복:
        a. `openList`에서 `f` 비용이 가장 낮은 노드(현재 노드)를 꺼낸다.
        b. 현재 노드가 도착점이면, `parent` 포인터를 역추적하여 최종 경로를 생성하고 반환한다.
        c. 현재 노드를 `closedList`에 추가한다.
        d. 현재 노드의 모든 인접 노드에 대해:
            i. 인접 노드가 `closedList`에 있거나 주행 불가능한 벽이면 무시한다.
            ii. 새로운 `g` 비용 (시작점 ~ 현재 노드 ~ 인접 노드)을 계산한다.
            iii. 인접 노드가 `openList`에 없거나, 새로 계산한 `g` 비용이 더 저렴하면:
                - `parent`를 현재 노드로 설정한다.
                - `g`, `h`, `f` 비용을 업데이트한다.
                - `openList`에 없었다면 추가한다.
    3.  경로를 찾지 못하면 `null`을 반환한다.

### 3단계: 게임에 통합 및 시각화

- **UI 추가:**
    - "최적 라인 계산" 버튼을 UI에 추가한다.
    - 계산 중임을 알리는 로딩 인디케이터를 표시한다. (계산이 수 초 이상 걸릴 수 있음)
- **로직 연결:**
    - 버튼 클릭 시 `findOptimalPath` 함수를 Web Worker에서 비동기적으로 실행하여 UI 멈춤 현상을 방지한다.
    - 계산이 완료되면 반환된 경로(좌표 배열)를 `idealLine` 상태에 저장한다.
- **시각화:**
    - 계산된 `idealLine`이 `canvas`에 즉시 그려지도록 한다.
    - AI 주행 모드에서 AI 차량이 이 새로운 `idealLine`을 따라 주행하도록 한다.

### 4단계: 검증 및 고도화

- **성능 검증:**
    - AI가 계산된 라인을 따라 주행했을 때의 랩타임을 측정한다.
    - 사람이 직접 그린 아이디얼 라인 주행 시의 랩타임과 비교하여 알고리즘의 효율성을 검증한다.
- **알고리즘 고도화 (개선 아이디어):**
    - **비용 함수 개선:** 차량의 가속/감속 능력, 타이어 그립 등을 비용 계산에 추가하여 더 현실적인 주행 모델을 만든다.
    - **경로 스무딩(Smoothing):** A\*로 찾은 경로는 각진 형태일 수 있다. 최종 경로에 스플라인(Spline) 보간법 등을 적용하여 부드러운 곡선으로 만들어 주행을 더 자연스럽게 한다.
    - **동적 경로 탐색:** 경기 중 다른 차량이나 장애물이 나타났을 때 실시간으로 경로를 재탐색하는 기능을 추가한다.

## 4. 예상 결과물

- 사용자가 버튼을 클릭하면 AI가 트랙의 최적 주행 라인을 계산하여 시각적으로 보여준다.
- AI는 계산된 라인을 따라 인간 플레이어보다 빠르거나 비슷한 수준의 랩타임을 기록한다.
- 향후 강화학습 등 더 복잡한 AI 알고리즘을 도입하기 위한 기반을 마련한다.

---

## ✅ 1단계: 서킷 맵 업데이트

### 🎯 목적
- 단순한 사각형 그리드가 아닌, 실제 F1 서킷 탑다운 뷰 기반으로 주행 맵 구성

### 🛠️ 진행 방식

#### 1. 탑다운 이미지 기반 벡터화
```javascript
// 서킷 이미지 처리 및 벡터화
class CircuitProcessor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.trackPoints = [];
        this.trackBoundaries = [];
    }

    // 이미지에서 트랙 경로 추출
    extractTrackPath(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // 트랙 색상 감지 (예: 검은색 = 트랙)
        for (let y = 0; y < height; y += 5) {
            for (let x = 0; x < width; x += 5) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // 트랙 색상 판정 (검은색)
                if (r < 50 && g < 50 && b < 50) {
                    this.trackPoints.push({ x, y });
                }
            }
        }

        return this.optimizeTrackPath();
    }

    // 경로 최적화 (Douglas-Peucker 알고리즘)
    optimizeTrackPath(tolerance = 2) {
        return this.douglasPeucker(this.trackPoints, tolerance);
    }

    douglasPeucker(points, tolerance) {
        if (points.length <= 2) return points;

        let maxDistance = 0;
        let maxIndex = 0;

        for (let i = 1; i < points.length - 1; i++) {
            const distance = this.pointToLineDistance(
                points[i],
                points[0],
                points[points.length - 1]
            );

            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        if (maxDistance > tolerance) {
            const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
            const right = this.douglasPeucker(points.slice(maxIndex), tolerance);
            return left.slice(0, -1).concat(right);
        } else {
            return [points[0], points[points.length - 1]];
        }
    }
}
```

#### 2. 주행 라인용 좌표 배열 생성
```javascript
// 아이디얼 라인 생성기
class IdealLineGenerator {
    constructor(trackPoints) {
        this.trackPoints = trackPoints;
        this.idealLine = [];
    }

    // 중간 라인 생성
    generateCenterLine() {
        const centerLine = [];

        for (let i = 0; i < this.trackPoints.length - 1; i++) {
            const current = this.trackPoints[i];
            const next = this.trackPoints[i + 1];

            // 두 점의 중간점 계산
            const midPoint = {
                x: (current.x + next.x) / 2,
                y: (current.y + next.y) / 2
            };

            centerLine.push(midPoint);
        }

        return this.smoothPath(centerLine);
    }

    // 경로 스무딩 (B-spline)
    smoothPath(points, tension = 0.5) {
        const smoothed = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = i > 0 ? points[i - 1] : points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = i < points.length - 2 ? points[i + 2] : p2;

            // B-spline 보간
            for (let t = 0; t <= 1; t += 0.1) {
                const x = this.cubicInterpolate(p0.x, p1.x, p2.x, p3.x, t, tension);
                const y = this.cubicInterpolate(p0.y, p1.y, p2.y, p3.y, t, tension);
                smoothed.push({ x, y });
            }
        }

        return smoothed;
    }

    cubicInterpolate(p0, p1, p2, p3, t, tension) {
        const t2 = t * t;
        const t3 = t2 * t;

        return (1 - tension) * (
            -t3 + 2 * t2 - t
        ) * p0 + (
            (2 - tension) * t3 + (tension - 3) * t2 + 1
        ) * p1 + (
            (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t
        ) * p2 + (
            t3 - t2
        ) * p3;
    }
}
```

#### 3. 세그먼트화 및 특징 추출
```javascript
// 트랙 세그먼트 분석기
class TrackSegmentAnalyzer {
    constructor(trackPoints) {
        this.trackPoints = trackPoints;
        this.segments = [];
    }

    // 세그먼트 분석
    analyzeSegments() {
        const segments = [];

        for (let i = 0; i < this.trackPoints.length - 2; i++) {
            const p1 = this.trackPoints[i];
            const p2 = this.trackPoints[i + 1];
            const p3 = this.trackPoints[i + 2];

            const segment = {
                start: p1,
                end: p2,
                type: this.classifySegment(p1, p2, p3),
                radius: this.calculateRadius(p1, p2, p3),
                angle: this.calculateAngle(p1, p2, p3),
                drsZone: this.isDRSZone(p1, p2),
                brakingZone: this.isBrakingZone(p1, p2, p3)
            };

            segments.push(segment);
        }

        return segments;
    }

    // 세그먼트 분류
    classifySegment(p1, p2, p3) {
        const angle = this.calculateAngle(p1, p2, p3);
        const radius = this.calculateRadius(p1, p2, p3);

        if (Math.abs(angle) < 10) return 'straight';
        if (Math.abs(angle) < 45) return 'sweeper';
        if (Math.abs(angle) < 90) return 'medium_corner';
        return 'hairpin';
    }

    // 곡률 반지름 계산
    calculateRadius(p1, p2, p3) {
        const a = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const b = Math.sqrt((p3.x - p2.x) ** 2 + (p3.y - p2.y) ** 2);
        const c = Math.sqrt((p3.x - p1.x) ** 2 + (p3.y - p1.y) ** 2);

        const s = (a + b + c) / 2;
        const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));

        return (a * b * c) / (4 * area);
    }
}
```

---

## ✅ 2단계: AI 주행 로직 + 주행 데이터 수집

### 🎯 목적
- AI가 "사용자 정의 경로(아이디얼 라인)"를 따라 달리게 하고,
- 주행 중 생기는 모든 데이터(Log)를 기록

### 🛠️ 진행 방식

#### 1. 기초 AI 주행 로직
```javascript
// AI 주행 컨트롤러
class AIDrivingController {
    constructor(car, trackData) {
        this.car = car;
        this.trackData = trackData;
        this.targetPoint = null;
        this.lookAheadDistance = 5;
        this.dataLogger = new DrivingDataLogger();
    }

    // AI 주행 업데이트
    update(deltaTime) {
        // 목표점 찾기
        this.findTargetPoint();

        // 조향 계산
        const steeringAngle = this.calculateSteering();

        // 속도 계산
        const targetSpeed = this.calculateTargetSpeed();

        // 제어 적용
        this.applyControls(steeringAngle, targetSpeed);

        // 데이터 로깅
        this.logDrivingData();
    }

    // 목표점 찾기
    findTargetPoint() {
        const currentPos = this.car.position;
        const idealLine = this.trackData.idealLine;

        // 현재 위치에서 가장 가까운 포인트 찾기
        let nearestIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < idealLine.length; i++) {
            const distance = this.calculateDistance(currentPos, idealLine[i]);
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = i;
            }
        }

        // 미리보기 거리만큼 앞의 포인트를 목표로 설정
        const targetIndex = Math.min(
            nearestIndex + this.lookAheadDistance,
            idealLine.length - 1
        );

        this.targetPoint = idealLine[targetIndex];
    }

    // 조향 각도 계산
    calculateSteering() {
        if (!this.targetPoint) return 0;

        const currentPos = this.car.position;
        const currentAngle = this.car.angle;

        // 목표점까지의 각도 계산
        const targetAngle = Math.atan2(
            this.targetPoint.y - currentPos.y,
            this.targetPoint.x - currentPos.x
        ) * 180 / Math.PI;

        // 각도 차이 계산
        let angleDiff = targetAngle - currentAngle;

        // 각도 정규화 (-180 ~ 180)
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;

        // 조향 제한
        return Math.max(-30, Math.min(30, angleDiff * 0.1));
    }

    // 목표 속도 계산
    calculateTargetSpeed() {
        const currentPos = this.car.position;
        const deviation = this.calculatePathDeviation(currentPos);

        // 기본 속도
        let targetSpeed = 15; // km/h

        // 경로 편차에 따른 속도 조정
        if (deviation > 2) {
            targetSpeed *= 0.7; // 편차가 크면 감속
        }

        // 코너 구간 감지
        const segment = this.getCurrentSegment(currentPos);
        if (segment && segment.type !== 'straight') {
            targetSpeed *= this.getCornerSpeedMultiplier(segment);
        }

        return targetSpeed;
    }

    // 경로 편차 계산
    calculatePathDeviation(position) {
        const idealLine = this.trackData.idealLine;
        let minDistance = Infinity;

        for (const point of idealLine) {
            const distance = this.calculateDistance(position, point);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        return minDistance;
    }
}
```

#### 2. 주행 데이터 로거
```javascript
// 주행 데이터 로거
class DrivingDataLogger {
    constructor() {
        this.logData = [];
        this.logInterval = 100; // 0.1초 간격
        this.lastLogTime = 0;
    }

    // 데이터 로깅
    logDrivingData(car, trackData) {
        const currentTime = Date.now();

        if (currentTime - this.lastLogTime >= this.logInterval) {
            const dataPoint = {
                timestamp: currentTime,
                carPosition: { x: car.position.x, y: car.position.y },
                speed: car.speed,
                rpm: car.engineRPM,
                gear: car.currentGear,
                steeringAngle: car.steeringAngle,
                deviationFromLine: this.calculateDeviation(car.position, trackData.idealLine),
                isOffTrack: this.isOffTrack(car.position, trackData),
                throttle: car.throttle,
                brake: car.brake,
                lapTime: car.currentLapTime,
                segment: this.getCurrentSegment(car.position, trackData)
            };

            this.logData.push(dataPoint);
            this.lastLogTime = currentTime;
        }
    }

    // 데이터 내보내기
    exportData(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.logData, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV();
        }
    }

    // CSV 변환
    convertToCSV() {
        if (this.logData.length === 0) return '';

        const headers = Object.keys(this.logData[0]);
        const csvRows = [headers.join(',')];

        for (const row of this.logData) {
            const values = headers.map(header => {
                const value = row[header];
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                return value;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }
}
```

---

## ✅ 3단계: 알고리즘 기반 AI 개선 (전통적 방식)

### 🎯 목적
- 수학/물리 기반의 규칙을 코드로 작성하여 AI가 "더 빠르고 안정적인 주행"을 하도록 만듦

### 🛠️ 진행 방식

#### 1. Apex/코너 반지름 계산
```javascript
// 코너 분석 및 최적 속도 계산
class CornerAnalyzer {
    constructor(trackData) {
        this.trackData = trackData;
        this.frictionCoefficient = 0.8; // 마찰계수
        this.gravity = 9.81; // 중력가속도
    }

    // 코너 최적 속도 계산
    calculateOptimalCornerSpeed(segment) {
        if (segment.type === 'straight') return 20; // km/h

        const radius = segment.radius;
        const angle = Math.abs(segment.angle);

        // 물리 공식: v = sqrt(μ × r × g)
        const optimalSpeed = Math.sqrt(
            this.frictionCoefficient * radius * this.gravity
        );

        // 코너 강도에 따른 보정
        const cornerIntensity = angle / 90; // 0~1
        const correctedSpeed = optimalSpeed * (1 - cornerIntensity * 0.3);

        return Math.min(correctedSpeed, 15); // 최대 속도 제한
    }

    // 브레이킹 포인트 계산
    calculateBrakingPoint(segment, currentSpeed) {
        const targetSpeed = this.calculateOptimalCornerSpeed(segment);
        const deceleration = 8; // m/s²

        // 제동 거리 계산: s = v² / (2a)
        const brakingDistance = (currentSpeed ** 2 - targetSpeed ** 2) / (2 * deceleration);

        return {
            distance: brakingDistance,
            targetSpeed: targetSpeed,
            deceleration: deceleration
        };
    }
}
```

#### 2. 고급 AI 주행 컨트롤러
```javascript
// 고급 AI 주행 컨트롤러
class AdvancedAIController {
    constructor(car, trackData) {
        this.car = car;
        this.trackData = trackData;
        this.cornerAnalyzer = new CornerAnalyzer(trackData);
        this.currentSegment = null;
        this.brakingPoint = null;
        this.apexPoint = null;
    }

    // 고급 AI 업데이트
    update(deltaTime) {
        // 현재 세그먼트 분석
        this.analyzeCurrentSegment();

        // 브레이킹 포인트 계산
        this.calculateBrakingStrategy();

        // 조향 및 속도 제어
        this.applyAdvancedControls();
    }

    // 현재 세그먼트 분석
    analyzeCurrentSegment() {
        const currentPos = this.car.position;
        this.currentSegment = this.findCurrentSegment(currentPos);

        if (this.currentSegment) {
            this.apexPoint = this.findApexPoint(this.currentSegment);
        }
    }

    // 브레이킹 전략 계산
    calculateBrakingStrategy() {
        if (!this.currentSegment || this.currentSegment.type === 'straight') {
            this.brakingPoint = null;
            return;
        }

        const currentSpeed = this.car.speed;
        const optimalSpeed = this.cornerAnalyzer.calculateOptimalCornerSpeed(this.currentSegment);

        if (currentSpeed > optimalSpeed) {
            const brakingInfo = this.cornerAnalyzer.calculateBrakingPoint(
                this.currentSegment,
                currentSpeed
            );

            this.brakingPoint = {
                distance: brakingInfo.distance,
                targetSpeed: brakingInfo.targetSpeed,
                deceleration: brakingInfo.deceleration
            };
        }
    }

    // 고급 제어 적용
    applyAdvancedControls() {
        // 조향 제어
        const steeringAngle = this.calculateAdvancedSteering();
        this.car.setSteering(steeringAngle);

        // 속도 제어
        const throttle = this.calculateThrottle();
        const brake = this.calculateBrake();

        this.car.setThrottle(throttle);
        this.car.setBrake(brake);

        // 기어 제어
        this.controlGear();
    }

    // 고급 조향 계산
    calculateAdvancedSteering() {
        if (!this.currentSegment) return 0;

        const currentPos = this.car.position;
        const targetPoint = this.getTargetPoint();

        // 기본 조향
        let steeringAngle = this.calculateBasicSteering(currentPos, targetPoint);

        // 코너 타입에 따른 조향 보정
        if (this.currentSegment.type === 'hairpin') {
            steeringAngle *= 1.5; // 헤어핀은 더 강한 조향
        } else if (this.currentSegment.type === 'sweeper') {
            steeringAngle *= 0.7; // 스위퍼는 부드러운 조향
        }

        return Math.max(-30, Math.min(30, steeringAngle));
    }

    // 스로틀 계산
    calculateThrottle() {
        if (!this.currentSegment) return 1.0;

        const currentSpeed = this.car.speed;
        const optimalSpeed = this.cornerAnalyzer.calculateOptimalCornerSpeed(this.currentSegment);

        if (this.brakingPoint && this.isInBrakingZone()) {
            return 0.0; // 브레이킹 구간에서는 스로틀 0
        }

        if (currentSpeed < optimalSpeed) {
            return 1.0; // 목표 속도보다 낮으면 가속
        } else {
            return 0.3; // 목표 속도보다 높으면 부분 스로틀
        }
    }

    // 브레이크 계산
    calculateBrake() {
        if (!this.brakingPoint || !this.isInBrakingZone()) {
            return 0.0;
        }

        const currentSpeed = this.car.speed;
        const targetSpeed = this.brakingPoint.targetSpeed;

        if (currentSpeed > targetSpeed) {
            return Math.min(1.0, (currentSpeed - targetSpeed) / 5);
        }

        return 0.0;
    }

    // 기어 제어
    controlGear() {
        const currentRPM = this.car.engineRPM;
        const currentGear = this.car.currentGear;

        // RPM 기반 자동 변속
        if (currentRPM > 6000 && currentGear < 6) {
            this.car.shiftUp();
        } else if (currentRPM < 2000 && currentGear > 1) {
            this.car.shiftDown();
        }

        // 코너 진입 시 다운시프트
        if (this.currentSegment && this.currentSegment.type !== 'straight') {
            if (this.car.speed > this.cornerAnalyzer.calculateOptimalCornerSpeed(this.currentSegment)) {
                if (currentGear > 2) {
                    this.car.shiftDown();
                }
            }
        }
    }
}
```

---

## ✅ 4단계: 머신러닝용 데이터 구축

### 🎯 목적
- AI의 성능을 스스로 향상시킬 수 있도록 학습용 데이터 구성

### 🛠️ 진행 방식

#### 1. 데이터 정제 및 라벨링
```javascript
// 주행 데이터 정제기
class DrivingDataProcessor {
    constructor(rawData) {
        this.rawData = rawData;
        this.processedData = [];
        this.labels = [];
    }

    // 데이터 정제
    processData() {
        for (const dataPoint of this.rawData) {
            const processed = this.processDataPoint(dataPoint);
            if (processed) {
                this.processedData.push(processed);
            }
        }

        return this.processedData;
    }

    // 개별 데이터 포인트 처리
    processDataPoint(dataPoint) {
        // 이상치 제거
        if (this.isOutlier(dataPoint)) {
            return null;
        }

        // 상태 벡터 구성
        const state = {
            speed: this.normalizeSpeed(dataPoint.speed),
            rpm: this.normalizeRPM(dataPoint.rpm),
            gear: dataPoint.gear,
            steeringAngle: this.normalizeSteering(dataPoint.steeringAngle),
            deviation: this.normalizeDeviation(dataPoint.deviationFromLine),
            throttle: dataPoint.throttle,
            brake: dataPoint.brake,
            distanceToApex: this.calculateDistanceToApex(dataPoint),
            angleToNextTurn: this.calculateAngleToNextTurn(dataPoint)
        };

        // 행동 벡터
        const action = {
            throttle: dataPoint.throttle,
            brake: dataPoint.brake,
            steer: this.normalizeSteering(dataPoint.steeringAngle),
            gear: dataPoint.gear
        };

        // 보상 계산
        const reward = this.calculateReward(dataPoint);

        return { state, action, reward };
    }

    // 보상 함수
    calculateReward(dataPoint) {
        let reward = 0;

        // 속도 보상 (빠를수록 높은 보상)
        reward += dataPoint.speed * 0.1;

        // 경로 편차 페널티
        reward -= dataPoint.deviationFromLine * 2;

        // 오프트랙 페널티
        if (dataPoint.isOffTrack) {
            reward -= 10;
        }

        // 부드러운 주행 보상
        if (Math.abs(dataPoint.steeringAngle) < 10) {
            reward += 0.5;
        }

        // 랩타임 보상
        if (dataPoint.lapTime < 60000) { // 1분 이하
            reward += 5;
        }

        return reward;
    }

    // 이상치 감지
    isOutlier(dataPoint) {
        // 비정상적인 속도
        if (dataPoint.speed > 25 || dataPoint.speed < -5) {
            return true;
        }

        // 비정상적인 조향
        if (Math.abs(dataPoint.steeringAngle) > 45) {
            return true;
        }

        // 비정상적인 편차
        if (dataPoint.deviationFromLine > 10) {
            return true;
        }

        return false;
    }

    // 데이터 정규화
    normalizeSpeed(speed) {
        return Math.max(0, Math.min(1, speed / 20));
    }

    normalizeRPM(rpm) {
        return Math.max(0, Math.min(1, rpm / 7000));
    }

    normalizeSteering(steering) {
        return Math.max(-1, Math.min(1, steering / 30));
    }

    normalizeDeviation(deviation) {
        return Math.max(0, Math.min(1, deviation / 5));
    }
}
```

#### 2. 학습 데이터셋 구성
```javascript
// 머신러닝 데이터셋 구성
class MLDataset {
    constructor(processedData) {
        this.processedData = processedData;
        this.trainingData = [];
        this.validationData = [];
        this.testData = [];
    }

    // 데이터셋 분할
    splitDataset(trainRatio = 0.7, valRatio = 0.2, testRatio = 0.1) {
        const shuffled = this.shuffleArray([...this.processedData]);

        const trainEnd = Math.floor(shuffled.length * trainRatio);
        const valEnd = trainEnd + Math.floor(shuffled.length * valRatio);

        this.trainingData = shuffled.slice(0, trainEnd);
        this.validationData = shuffled.slice(trainEnd, valEnd);
        this.testData = shuffled.slice(valEnd);

        return {
            training: this.trainingData,
            validation: this.validationData,
            test: this.testData
        };
    }

    // 상태-행동 쌍 추출
    extractStateActionPairs() {
        const pairs = [];

        for (const dataPoint of this.processedData) {
            pairs.push({
                state: dataPoint.state,
                action: dataPoint.action,
                reward: dataPoint.reward
            });
        }

        return pairs;
    }

    // 시퀀스 데이터 추출 (LSTM용)
    extractSequences(sequenceLength = 10) {
        const sequences = [];

        for (let i = 0; i < this.processedData.length - sequenceLength; i++) {
            const sequence = this.processedData.slice(i, i + sequenceLength);
            const nextAction = this.processedData[i + sequenceLength].action;

            sequences.push({
                states: sequence.map(d => d.state),
                actions: sequence.map(d => d.action),
                nextAction: nextAction,
                rewards: sequence.map(d => d.reward)
            });
        }

        return sequences;
    }

    // 배열 셔플
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
```

---

## ✅ 5단계: 머신러닝 AI 설계 및 학습

### 🎯 목적
- 딥러닝/강화학습을 통해 AI가 스스로 최적의 주행 전략을 학습

### 🛠️ 진행 방식

#### 1. 신경망 모델 설계
```javascript
// TensorFlow.js를 사용한 신경망 모델
class DrivingNeuralNetwork {
    constructor() {
        this.model = null;
        this.optimizer = null;
        this.lossFunction = null;
    }

    // 모델 생성
    createModel() {
        this.model = tf.sequential({
            layers: [
                // 입력층
                tf.layers.dense({
                    units: 128,
                    activation: 'relu',
                    inputShape: [10] // 상태 벡터 크기
                }),

                // 은닉층들
                tf.layers.dense({
                    units: 256,
                    activation: 'relu'
                }),

                tf.layers.dropout(0.2),

                tf.layers.dense({
                    units: 128,
                    activation: 'relu'
                }),

                tf.layers.dropout(0.2),

                // 출력층
                tf.layers.dense({
                    units: 4, // [throttle, brake, steer, gear]
                    activation: 'tanh'
                })
            ]
        });

        // 컴파일
        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['accuracy']
        });

        return this.model;
    }

    // 학습
    async train(trainingData, validationData, epochs = 100) {
        const { states, actions } = this.prepareTrainingData(trainingData);

        const history = await this.model.fit(states, actions, {
            epochs: epochs,
            batchSize: 32,
            validationData: [validationData.states, validationData.actions],
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, val_loss = ${logs.val_loss.toFixed(4)}`);
                }
            }
        });

        return history;
    }

    // 예측
    predict(state) {
        const input = tf.tensor2d([state], [1, state.length]);
        const prediction = this.model.predict(input);
        const result = prediction.arraySync()[0];

        return {
            throttle: Math.max(0, Math.min(1, result[0])),
            brake: Math.max(0, Math.min(1, result[1])),
            steer: Math.max(-1, Math.min(1, result[2])),
            gear: Math.round(Math.max(1, Math.min(6, result[3])))
        };
    }

    // 학습 데이터 준비
    prepareTrainingData(data) {
        const states = [];
        const actions = [];

        for (const dataPoint of data) {
            states.push([
                dataPoint.state.speed,
                dataPoint.state.rpm,
                dataPoint.state.gear,
                dataPoint.state.steeringAngle,
                dataPoint.state.deviation,
                dataPoint.state.throttle,
                dataPoint.state.brake,
                dataPoint.state.distanceToApex,
                dataPoint.state.angleToNextTurn,
                dataPoint.reward
            ]);

            actions.push([
                dataPoint.action.throttle,
                dataPoint.action.brake,
                dataPoint.action.steer,
                dataPoint.action.gear
            ]);
        }

        return {
            states: tf.tensor2d(states),
            actions: tf.tensor2d(actions)
        };
    }
}
```

#### 2. 강화학습 에이전트
```javascript
// DQN (Deep Q-Network) 에이전트
class DQNAgent {
    constructor(stateSize, actionSize) {
        this.stateSize = stateSize;
        this.actionSize = actionSize;
        this.memory = [];
        this.gamma = 0.95; // 할인율
        this.epsilon = 1.0; // 탐험률
        this.epsilonMin = 0.01;
        this.epsilonDecay = 0.995;
        this.learningRate = 0.001;
        this.model = this.createModel();
        this.targetModel = this.createModel();
        this.updateTargetModel();
    }

    // 모델 생성
    createModel() {
        const model = tf.sequential();

        model.add(tf.layers.dense({
            units: 128,
            inputShape: [this.stateSize],
            activation: 'relu'
        }));

        model.add(tf.layers.dense({
            units: 256,
            activation: 'relu'
        }));

        model.add(tf.layers.dense({
            units: this.actionSize,
            activation: 'linear'
        }));

        model.compile({
            optimizer: tf.train.adam(this.learningRate),
            loss: 'meanSquaredError'
        });

        return model;
    }

    // 행동 선택
    act(state) {
        if (Math.random() <= this.epsilon) {
            // 탐험: 랜덤 행동
            return Math.floor(Math.random() * this.actionSize);
        }

        // 활용: 모델 예측
        const stateTensor = tf.tensor2d([state], [1, this.stateSize]);
        const qValues = this.model.predict(stateTensor);
        const action = qValues.argMax(1).dataSync()[0];

        return action;
    }

    // 경험 저장
    remember(state, action, reward, nextState, done) {
        this.memory.push({
            state: state,
            action: action,
            reward: reward,
            nextState: nextState,
            done: done
        });

        // 메모리 크기 제한
        if (this.memory.length > 10000) {
            this.memory.shift();
        }
    }

    // 학습
    replay(batchSize) {
        if (this.memory.length < batchSize) return;

        const batch = this.getRandomBatch(batchSize);
        const states = [];
        const targets = [];

        for (const experience of batch) {
            const target = this.model.predict(tf.tensor2d([experience.state]))[0];

            if (experience.done) {
                target[experience.action] = experience.reward;
            } else {
                const nextStateQValues = this.targetModel.predict(tf.tensor2d([experience.nextState]))[0];
                target[experience.action] = experience.reward + this.gamma * Math.max(...nextStateQValues);
            }

            states.push(experience.state);
            targets.push(target);
        }

        this.model.fit(tf.tensor2d(states), tf.tensor2d(targets), {
            epochs: 1,
            verbose: 0
        });

        // 탐험률 감소
        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay;
        }
    }

    // 타겟 모델 업데이트
    updateTargetModel() {
        this.targetModel.setWeights(this.model.getWeights());
    }

    // 랜덤 배치 선택
    getRandomBatch(batchSize) {
        const batch = [];
        for (let i = 0; i < batchSize; i++) {
            const randomIndex = Math.floor(Math.random() * this.memory.length);
            batch.push(this.memory[randomIndex]);
        }
        return batch;
    }
}
```

#### 3. 학습 파이프라인
```javascript
// 전체 학습 파이프라인
class LearningPipeline {
    constructor(gameEnvironment, agent) {
        this.environment = gameEnvironment;
        this.agent = agent;
        this.episodes = 1000;
        this.maxSteps = 1000;
        this.batchSize = 32;
    }

    // 학습 실행
    async train() {
        const trainingHistory = [];

        for (let episode = 0; episode < this.episodes; episode++) {
            const episodeReward = await this.runEpisode();
            trainingHistory.push(episodeReward);

            // 배치 학습
            if (this.agent.memory.length >= this.batchSize) {
                this.agent.replay(this.batchSize);
            }

            // 타겟 모델 업데이트 (매 10 에피소드마다)
            if (episode % 10 === 0) {
                this.agent.updateTargetModel();
            }

            console.log(`Episode ${episode + 1}/${this.episodes}, Reward: ${episodeReward.toFixed(2)}, Epsilon: ${this.agent.epsilon.toFixed(3)}`);
        }

        return trainingHistory;
    }

    // 에피소드 실행
    async runEpisode() {
        this.environment.reset();
        let totalReward = 0;
        let steps = 0;

        while (steps < this.maxSteps && !this.environment.isDone()) {
            const currentState = this.environment.getState();
            const action = this.agent.act(currentState);

            const { nextState, reward, done } = this.environment.step(action);

            this.agent.remember(currentState, action, reward, nextState, done);

            totalReward += reward;
            steps++;

            // 비동기 처리
            await new Promise(resolve => setTimeout(resolve, 16)); // 60 FPS
        }

        return totalReward;
    }

    // 성능 평가
    evaluate(episodes = 100) {
        const evaluationRewards = [];

        for (let episode = 0; episode < episodes; episode++) {
            const reward = this.runEvaluationEpisode();
            evaluationRewards.push(reward);
        }

        const averageReward = evaluationRewards.reduce((a, b) => a + b, 0) / episodes;
        const stdDev = this.calculateStandardDeviation(evaluationRewards);

        return {
            averageReward,
            stdDev,
            rewards: evaluationRewards
        };
    }

    // 평가용 에피소드 (탐험 없음)
    runEvaluationEpisode() {
        this.environment.reset();
        let totalReward = 0;
        let steps = 0;

        const originalEpsilon = this.agent.epsilon;
        this.agent.epsilon = 0; // 탐험 없음

        while (steps < this.maxSteps && !this.environment.isDone()) {
            const currentState = this.environment.getState();
            const action = this.agent.act(currentState);

            const { nextState, reward, done } = this.environment.step(action);

            totalReward += reward;
            steps++;
        }

        this.agent.epsilon = originalEpsilon;
        return totalReward;
    }

    // 표준편차 계산
    calculateStandardDeviation(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(avgSquaredDiff);
    }
}
```

---

## 🎯 최종 구조 요약

```
물리엔진 완료 →
서킷 탑다운 구축 →
AI 주행 (기초 경로 추적) →
주행 로그 수집 →
전통 알고리즘 설계 →
정답지 데이터 수집 →
보상/학습 구조 설계 →
머신러닝 기반 AI 학습 →
성능 개선 반복
```

이 계획을 통해 단계적으로 AI 시스템을 발전시켜, 최종적으로는 실제 F1 드라이버 수준의 주행 능력을 가진 AI를 구현할 수 있습니다.