// 트랙 생성/맵 데이터 관련 함수 모듈

export function createTrackLayout() {
    const W = 200, H = 120;
    const layout = Array(H).fill().map(() => Array(W).fill(0));
    const cx = W / 2, cy = H / 2;
    const outerR = 60;
    const innerR = 35;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const dx = (x - cx) / 1.1;
            const dy = (y - cy);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < outerR && dist > innerR) layout[y][x] = 1;
        }
    }
    const startFinishY = Math.floor(cy);
    for (let x = Math.floor(cx - outerR); x < Math.floor(cx + outerR); x++) {
        if (x >= 0 && x < W && layout[startFinishY][x] === 1) {
            layout[startFinishY][x] = 2;
        }
    }
    return layout;
}

export function isRoadCell(cell) {
    return cell === 1 || cell === 2 || cell === 3;
}

// 필요시 추가 트랙 생성 함수 등도 export
// ...