export class Timer {
  private end: number;
  public currentTick: number;

  constructor(end: number) {
    this.end = end;
    this.currentTick = 0;
  }

  public update(newTicker: number = 1): void {
    if(!this.isDone()) this.currentTick += newTicker;
  }

  public reset(): void {
    this.currentTick = 0;
  }

  public isDone(addedValues: number = 0): boolean {
    return this.currentTick >= this.end + addedValues;
  }
}