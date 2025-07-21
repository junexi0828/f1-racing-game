# F1 레이싱 게임 AI 시스템 개발 계획

## 🎯 전체 목표
AI가 실제 F1 서킷을 빠르고 정확하게 주행할 수 있는 시스템을 점진적으로 학습/최적화하도록 만든다.

---

## 📋 통합 개발 계획

### 🎯 핵심 알고리즘: A* (A-Star) + 물리 기반 최적화

**선정 이유:** A* 알고리즘은 목표 지점까지의 최단 경로를 효율적으로 찾는 데 검증된 강력한 알고리즘이다. 게임 AI의 길 찾기(Pathfinding) 문제에 매우 적합하며, '시간'이라는 비용을 기준으로 랩타임 최적화에 직접 적용할 수 있다.

**동작 원리:** `f(n) = g(n) + h(n)`
- `g(n)`: 시작점에서 현재 위치(n)까지의 실제 비용 (누적 주행 시간)
- `h(n)`: 현재 위치(n)에서 도착점까지의 예상 비용 (추정 남은 시간)
- `f(n)`: 총 예상 비용. 이 값이 가장 작은 노드를 우선적으로 탐색하여 최적 경로를 찾는다.

---

## ✅ 1단계: 서킷 맵 업데이트 + 문제 모델링

### 🎯 목적
- 단순한 사각형 그리드가 아닌, 실제 F1 서킷 탑다운 뷰 기반으로 주행 맵 구성
- AI가 이해할 수 있는 그래프 데이터 구조 정의

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

#### 2. 그래프(Graph) 표현 정의
```javascript
// 트랙 그래프 모델링
class TrackGraphModel {
    constructor(trackLayout) {
        this.trackLayout = trackLayout;
        this.nodes = [];
        this.edges = [];
        this.buildGraph();
    }

    // 그래프 구축
    buildGraph() {
        const width = this.trackLayout[0].length;
        const height = this.trackLayout.length;

        // 노드 생성 (주행 가능한 모든 셀)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (this.isRoadCell(this.trackLayout[y][x])) {
                    this.nodes.push({
                        x: x,
                        y: y,
                        g: 0,      // 시작점에서 현재까지의 실제 비용
                        h: 0,      // 현재에서 도착점까지의 예상 비용
                        f: 0,      // 총 예상 비용
                        parent: null
                    });
                }
            }
        }

        // 간선 생성 (8방향 이동)
        this.buildEdges();
    }

    // 도로 셀 판정
    isRoadCell(cell) {
        return cell === 1 || cell === 2 || cell === 3;
    }

    // 간선 구축
    buildEdges() {
        for (const node of this.nodes) {
            const neighbors = this.getNeighbors(node);
            for (const neighbor of neighbors) {
                this.edges.push({
                    from: node,
                    to: neighbor,
                    cost: this.calculateCost(node, neighbor)
                });
            }
        }
    }

    // 인접 노드 찾기
    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dx, dy] of directions) {
            const newX = node.x + dx;
            const newY = node.y + dy;

            if (this.isValidPosition(newX, newY) &&
                this.isRoadCell(this.trackLayout[newY][newX])) {
                neighbors.push({ x: newX, y: newY });
            }
        }

        return neighbors;
    }

    // 비용 계산 함수 (핵심!)
    calculateCost(fromNode, toNode) {
        // 거리 계산
        const distance = Math.sqrt(
            (toNode.x - fromNode.x) ** 2 +
            (toNode.y - fromNode.y) ** 2
        );

        // 회전 각도 계산
        const angleChange = this.calculateAngleChange(fromNode, toNode);

        // 속도 결정 (회전 각도에 따라)
        const speed = this.calculateSpeed(angleChange);

        // 시간 = 거리 / 속도
        return distance / speed;
    }

    // 회전 각도 변화 계산
    calculateAngleChange(fromNode, toNode) {
        if (!fromNode.parent) return 0;

        const prevDir = {
            x: fromNode.x - fromNode.parent.x,
            y: fromNode.y - fromNode.parent.y
        };

        const currentDir = {
            x: toNode.x - fromNode.x,
            y: toNode.y - fromNode.y
        };

        const angle1 = Math.atan2(prevDir.y, prevDir.x);
        const angle2 = Math.atan2(currentDir.y, currentDir.x);

        return Math.abs(angle2 - angle1) * 180 / Math.PI;
    }

    // 속도 계산 (회전 각도에 따라)
    calculateSpeed(angleChange) {
        const maxSpeed = 20; // 최대 속도 (km/h)
        const minSpeed = 5;  // 최소 속도 (km/h)

        // 각도 변화가 클수록 속도 감소
        const speedReduction = Math.min(angleChange / 90, 1);
        return maxSpeed - (maxSpeed - minSpeed) * speedReduction;
    }

    // 유효한 위치인지 확인
    isValidPosition(x, y) {
        return x >= 0 && x < this.trackLayout[0].length &&
               y >= 0 && y < this.trackLayout.length;
    }
}
```

---

## ✅ 2단계: A* 알고리즘 구현 + AI 주행 로직

### 🎯 목적
- A* 알고리즘을 사용한 최적 경로 탐색
- AI가 계산된 경로를 따라 주행하는 로직 구현
- 주행 데이터 수집 시스템 구축

### 🛠️ 진행 방식

#### 1. A* 알고리즘 구현
```javascript
// A* 경로 탐색 알고리즘
class AStarPathfinder {
    constructor(trackGraph) {
        this.trackGraph = trackGraph;
        this.openList = [];
        this.closedList = new Set();
    }

    // 최적 경로 찾기
    findOptimalPath(startNode, endNode) {
        // 초기화
        this.openList = [startNode];
        this.closedList.clear();

        startNode.g = 0;
        startNode.h = this.calculateHeuristic(startNode, endNode);
        startNode.f = startNode.g + startNode.h;

        while (this.openList.length > 0) {
            // f 비용이 가장 낮은 노드 선택
            const currentNode = this.getLowestFCostNode();

            // 목표 도달 확인
            if (this.isGoalReached(currentNode, endNode)) {
                return this.reconstructPath(currentNode);
            }

            // 현재 노드를 closed list에 추가
            this.closedList.add(currentNode);
            this.removeFromOpenList(currentNode);

            // 인접 노드 탐색
            const neighbors = this.getNeighbors(currentNode);
            for (const neighbor of neighbors) {
                if (this.closedList.has(neighbor)) continue;

                const tentativeG = currentNode.g + this.calculateCost(currentNode, neighbor);

                if (!this.openList.includes(neighbor) || tentativeG < neighbor.g) {
                    neighbor.parent = currentNode;
                    neighbor.g = tentativeG;
                    neighbor.h = this.calculateHeuristic(neighbor, endNode);
                    neighbor.f = neighbor.g + neighbor.h;

                    if (!this.openList.includes(neighbor)) {
                        this.openList.push(neighbor);
                    }
                }
            }
        }

        return null; // 경로를 찾지 못함
    }

    // f 비용이 가장 낮은 노드 찾기
    getLowestFCostNode() {
        let lowestNode = this.openList[0];
        for (const node of this.openList) {
            if (node.f < lowestNode.f) {
                lowestNode = node;
            }
        }
        return lowestNode;
    }

    // 휴리스틱 함수 (유클리드 거리)
    calculateHeuristic(node, goal) {
        return Math.sqrt(
            (goal.x - node.x) ** 2 +
            (goal.y - node.y) ** 2
        );
    }

    // 목표 도달 확인
    isGoalReached(currentNode, endNode) {
        return currentNode.x === endNode.x && currentNode.y === endNode.y;
    }

    // 경로 재구성
    reconstructPath(endNode) {
        const path = [];
        let currentNode = endNode;

        while (currentNode !== null) {
            path.unshift({ x: currentNode.x, y: currentNode.y });
            currentNode = currentNode.parent;
        }

        return path;
    }

    // 비용 계산
    calculateCost(fromNode, toNode) {
        const distance = Math.sqrt(
            (toNode.x - fromNode.x) ** 2 +
            (toNode.y - fromNode.y) ** 2
        );

        const angleChange = this.calculateAngleChange(fromNode, toNode);
        const speed = this.calculateSpeed(angleChange);

        return distance / speed;
    }

    // 회전 각도 변화 계산
    calculateAngleChange(fromNode, toNode) {
        if (!fromNode.parent) return 0;

        const prevDir = {
            x: fromNode.x - fromNode.parent.x,
            y: fromNode.y - fromNode.parent.y
        };

        const currentDir = {
            x: toNode.x - fromNode.x,
            y: toNode.y - fromNode.y
        };

        const angle1 = Math.atan2(prevDir.y, prevDir.x);
        const angle2 = Math.atan2(currentDir.y, currentDir.x);

        return Math.abs(angle2 - angle1) * 180 / Math.PI;
    }

    // 속도 계산
    calculateSpeed(angleChange) {
        const maxSpeed = 20;
        const minSpeed = 5;
        const speedReduction = Math.min(angleChange / 90, 1);
        return maxSpeed - (maxSpeed - minSpeed) * speedReduction;
    }

    // 인접 노드 찾기
    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dx, dy] of directions) {
            const newX = node.x + dx;
            const newY = node.y + dy;

            if (this.isValidPosition(newX, newY)) {
                const neighbor = this.findNodeAt(newX, newY);
                if (neighbor) {
                    neighbors.push(neighbor);
                }
            }
        }

        return neighbors;
    }

    // 특정 위치의 노드 찾기
    findNodeAt(x, y) {
        return this.trackGraph.nodes.find(node =>
            node.x === x && node.y === y
        );
    }

    // 유효한 위치인지 확인
    isValidPosition(x, y) {
        return x >= 0 && x < this.trackGraph.trackLayout[0].length &&
               y >= 0 && y < this.trackGraph.trackLayout.length;
    }

    // open list에서 노드 제거
    removeFromOpenList(node) {
        const index = this.openList.indexOf(node);
        if (index > -1) {
            this.openList.splice(index, 1);
        }
    }
}
```

#### 2. AI 주행 컨트롤러
```javascript
// AI 주행 컨트롤러
class AIDrivingController {
    constructor(car, trackData) {
        this.car = car;
        this.trackData = trackData;
        this.targetPoint = null;
        this.lookAheadDistance = 5;
        this.dataLogger = new DrivingDataLogger();
        this.pathfinder = new AStarPathfinder(trackData.graph);
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

---

## ✅ 3단계: 물리 기반 알고리즘 개선

### 🎯 목적
- 수학/물리 기반의 규칙을 코드로 작성하여 AI가 "더 빠르고 안정적인 주행"을 하도록 만듦
- A* 결과를 물리적으로 최적화

### 🛠️ 진행 방식

#### 1. 코너 분석 및 최적 속도 계산
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

---

## ✅ 4단계: 머신러닝용 데이터 구축

### 🎯 목적
- AI의 성능을 스스로 향상시킬 수 있도록 학습용 데이터 구성
- A* 결과와 물리 기반 결과를 학습 데이터로 활용

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
}
```

---

## ✅ 5단계: 머신러닝 AI 설계 및 학습

### 🎯 목적
- 딥러닝/강화학습을 통해 AI가 스스로 최적의 주행 전략을 학습
- A* 결과를 초기 가이드로 활용하여 학습 속도 향상

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
}
```

---

## 🎯 최종 구조 요약

```
물리엔진 완료 →
서킷 맵 업데이트 + A* 그래프 모델링 →
A* 알고리즘 구현 + AI 주행 로직 →
물리 기반 알고리즘 개선 →
머신러닝용 데이터 구축 →
머신러닝 AI 학습 →
성능 개선 반복
```

이 통합 계획을 통해 A* 알고리즘의 효율적인 경로 탐색과 물리 기반 최적화, 그리고 머신러닝의 학습 능력을 모두 활용하여 최고 성능의 F1 AI 드라이버를 구현할 수 있습니다.