import 'mocha';
import { expect } from 'chai';
import { throttle, ITimer } from '@/presentation/components/Shared/Throttle';
import { EventSource } from '@/infrastructure/Events/EventSource';
import { IEventSubscription } from '@/infrastructure/Events/IEventSource';

describe('throttle', () => {
    it('throws if callback is undefined', () => {
        // arrange
        const expectedError = 'undefined callback';
        const callback = undefined;
        // act
        const act = () => throttle(callback, 500);
        // assert
        expect(act).to.throw(expectedError);
    });
    describe('throws if waitInMs is negative or zero', () => {
        // arrange
        const testCases = [
            { value: 0, expectedError: 'no delay to throttle' },
            { value: -2, expectedError: 'negative delay' },
        ];
        const callback = () => { return; };
        for (const testCase of testCases) {
            it(`"${testCase.value}" throws "${testCase.expectedError}"`, () => {
                // act
                const waitInMs = testCase.value;
                const act = () => throttle(callback, waitInMs);
                // assert
                expect(act).to.throw(testCase.expectedError);
            });
        }
    });
    it('should call the callback immediately', () => {
        // arrange
        const timer = new TimerMock();
        let totalRuns = 0;
        const callback = () => totalRuns++;
        const throttleFunc = throttle(callback, 500, timer);
        // act
        throttleFunc();
        // assert
        expect(totalRuns).to.equal(1);
    });
    it('should call the callback again after the timeout', () => {
        // arrange
        const timer = new TimerMock();
        let totalRuns = 0;
        const callback = () => totalRuns++;
        const waitInMs = 500;
        const throttleFunc = throttle(callback, waitInMs, timer);
        // act
        throttleFunc();
        totalRuns--; // So we don't count the initial run
        throttleFunc();
        timer.tickNext(waitInMs);
        // assert
        expect(totalRuns).to.equal(1);
    });
    it('should call the callback at most once at given time', () => {
        // arrange
        const timer = new TimerMock();
        let totalRuns = 0;
        const callback = () => totalRuns++;
        const waitInMs = 500;
        const totalCalls = 10;
        const throttleFunc = throttle(callback, waitInMs, timer);
        // act
        for (let i = 0; i < totalCalls; i++) {
            timer.setCurrentTime(waitInMs / totalCalls * i);
            throttleFunc();
        }
        // assert
        expect(totalRuns).to.equal(2); // one initial and one at the end
    });
    it('should call the callback as long as delay is waited', () => {
        // arrange
        const timer = new TimerMock();
        let totalRuns = 0;
        const callback = () => totalRuns++;
        const waitInMs = 500;
        const expectedTotalRuns = 10;
        const throttleFunc = throttle(callback, waitInMs, timer);
        // act
        for (let i = 0; i < expectedTotalRuns; i++) {
            throttleFunc();
            timer.tickNext(waitInMs);
        }
        // assert
        expect(totalRuns).to.equal(expectedTotalRuns);
    });
    it('should call arguments as expected', () => {
        // arrange
        const timer = new TimerMock();
        const expected = [ 1, 2, 3 ];
        const actual = new Array<number>();
        const callback = (arg: number) => { actual.push(arg); };
        const waitInMs = 500;
        const throttleFunc = throttle(callback, waitInMs, timer);
        // act
        for (const arg of expected) {
            throttleFunc(arg);
            timer.tickNext(waitInMs);
        }
        // assert
        expect(expected).to.deep.equal(actual);
    });
});

class TimerMock implements ITimer {
    private timeChanged = new EventSource<number>();
    private subscriptions = new Array<IEventSubscription>();
    private currentTime = 0;
    public setTimeout(callback: () => void, ms: number): NodeJS.Timeout {
        const runTime = this.currentTime + ms;
        const subscription = this.timeChanged.on((time) => {
            if (time >= runTime) {
                callback();
                subscription.unsubscribe();
            }
        });
        this.subscriptions.push(subscription);
        return (this.subscriptions.length - 1) as any;
    }
    public clearTimeout(timeoutId: NodeJS.Timeout): void {
        this.subscriptions[timeoutId as any].unsubscribe();
    }
    public dateNow(): number {
        return this.currentTime;
    }
    public tickNext(ms: number): void {
        this.setCurrentTime(this.currentTime + ms);
    }
    public setCurrentTime(ms: number): void {
        this.currentTime = ms;
        this.timeChanged.notify(this.currentTime);
    }
}
