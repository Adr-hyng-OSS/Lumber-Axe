export class Timer {
    constructor(end) {
        this.end = end;
        this.currentTick = 0;
    }
    update(newTicker = 1) {
        if (!this.isDone())
            this.currentTick += newTicker;
    }
    reset() {
        this.currentTick = 0;
    }
    isDone(addedValues = 0) {
        return this.currentTick >= this.end + addedValues;
    }
}
