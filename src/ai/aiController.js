// AI 주행 로직(경로 추적, lookahead, steering, speed 등) 모듈

export function findNextTargetPoint(currentPos, idealLine, lookAhead = 5) {
    if (idealLine.length === 0) return null;
    let nearest = idealLine[0];
    let minDist = Math.sqrt((currentPos.x - nearest.x) ** 2 + (currentPos.y - nearest.y) ** 2);
    for (let i = 1; i < idealLine.length; i++) {
        const dist = Math.sqrt((currentPos.x - idealLine[i].x) ** 2 + (currentPos.y - idealLine[i].y) ** 2);
        if (dist < minDist) {
            minDist = dist;
            nearest = idealLine[i];
        }
    }
    const currentIndex = idealLine.indexOf(nearest);
    const nextIndex = Math.min(currentIndex + lookAhead, idealLine.length - 1);
    return idealLine[nextIndex];
}

export function calculatePathDeviation(currentPos, idealLine) {
    if (idealLine.length === 0) return 0;
    let minDist = Math.sqrt((currentPos.x - idealLine[0].x) ** 2 + (currentPos.y - idealLine[0].y) ** 2);
    for (let i = 1; i < idealLine.length; i++) {
        const dist = Math.sqrt((currentPos.x - idealLine[i].x) ** 2 + (currentPos.y - idealLine[i].y) ** 2);
        if (dist < minDist) {
            minDist = dist;
        }
    }
    return minDist;
}

// AI 주행 컨트롤러 등 추가 함수/클래스도 export
// ...