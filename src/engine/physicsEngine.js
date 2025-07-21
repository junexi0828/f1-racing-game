import { isRoadCell } from '../track/trackLayout';

// 차량 물리, 충돌, 변속 등 엔진 관련 함수/클래스 모듈

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
        return {
            collision: true,
            position: nearestRoad || currentPos,
            angle: calculateReflectionAngle(carAngle, newPos, currentPos),
            speed: Math.max(speed * 0.2, 0),
            type: 'wall'
        };
    }
    return { collision: false };
}

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

export function calculateReflectionAngle(carAngle, collisionPos, prevPos) {
    const collisionDirX = collisionPos.x - prevPos.x;
    const collisionDirY = collisionPos.y - prevPos.y;
    const collisionAngle = Math.atan2(collisionDirY, collisionDirX) * 180 / Math.PI;
    const reflectionAngle = collisionAngle + 180 + (Math.random() - 0.5) * 60;
    return reflectionAngle;
}