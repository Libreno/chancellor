// Copyright © 2020, Farkhad Muminov. All rights reserved.
export interface IAFState{
  setTopDataHasMore: (hasMore: boolean) => void,
  incCounter: (counterName: any, addValue: number) => void,
  setCounter: (counterName: any, newVal: number) => void
}

class AFState implements IAFState {
  setState = (arg: any) => { };
  setStateF = (arg: any) => { };

  constructor(setParentState: any, setParentStateF: any) {
    this.setState = setParentState;
    this.setStateF = setParentStateF;
    this.setTopDataHasMore = this.setTopDataHasMore.bind(this);
    this.incCounter = this.incCounter.bind(this);
    this.changeCounter_ = this.changeCounter_.bind(this);
  }

  setTopDataHasMore(hasMore: boolean) {
    this.setState({
      topDataHasMore: hasMore
    });
  }

  changeCounter_(counterName: any, addVal = 1, valueFunc: any) {
    this.setStateF((state: any) => {
      const counters = Object.assign({}, state.counters);
      counters[counterName] = valueFunc((counters[counterName] ?? 0), addVal);
      // log(`rS ${counters.requestsSent}, rQ ${counters.requestsQueued}, fC ${counters.friendsCount}, fDR ${counters.friendsDataReceived}, aCE ${counters.attemptsCountExceeded}, fER ${counters.friendsErrorResponse}`)
      return {
        counters: counters
      };
    });
  }

  incCounter(counterName: any, addVal = 1) {
    this.changeCounter_(counterName, addVal,
      (currentValue: any, passedValue: any) => currentValue + passedValue);
  }

  setCounter(counterName: any, newVal: number) {
    this.changeCounter_(counterName, newVal,
      (_: any, passedValue: any) => passedValue);
  }
}

export default AFState