// Copyright © 2020, Farkhad Muminov. All rights reserved.
import bridge, { UserInfo } from "@vkontakte/vk-bridge"
import log, { warn } from "../logger"

const APP_ID = 7505513
const APP_SCOPE = "friends"
const API_VERSION = "5.110"
const FRIENDS_GET_METHOD_NAME = "friends.get"
const GROUPS_GET_MOTHOD_NAME = "groups.get"
const USERS_GET_METHOD_NAME = "users.get"
const FRIENDS_MAX_COUNT_PER_REQUEST = 5000
const REQUEST_ATTEMPTS_COUNT_MAX = 9
const API_REQUEST_INTERVAL = 350
const RATE_LIMIT_REACHED_ERROR = 29
const DELETED_OR_CLOSED_ERRORS = [30, 7, 18]

const KNOWN_ERRORS = DELETED_OR_CLOSED_ERRORS.concat(RATE_LIMIT_REACHED_ERROR)

interface IVKDataService{
  loadInitialData: () => Promise<[UserInfo, { access_token: string; scope: string}]>,
  updateTopData: (groupsData: Map<any, any>, topDataArr: Array<any>) => boolean
  getUser: (token: string, timers: any, incCounter: any, userName: string) => Promise<unknown>
  getFriends: (props: any) => Promise<Promise<any>[]>,
  handleFriend: (props: any, friendId: number) => Promise<unknown>
}

class VKDataService implements IVKDataService{
  loadInitialData() {
    return Promise.all([
      bridge.send('VKWebAppGetUserInfo'),
      bridge.send("VKWebAppGetAuthToken", {app_id: APP_ID, scope: APP_SCOPE})
    ])
  }

  async getFriends(props: any) {
    let params = { user_id: props.fetchedUser.id, count: FRIENDS_MAX_COUNT_PER_REQUEST }
    const resp = await this.callAPI_(props, FRIENDS_GET_METHOD_NAME, this.getRequestId_(props.fetchedUser?.id, FRIENDS_GET_METHOD_NAME, null), params)
    return this.onFriendsDataReceived_(props, resp)
  }

  async handleFriend (props: any, friendId: number) {
    const tryGetFriendsData = (tryNum: number) => {
      this.callAPIGetGroups_(props, friendId).then((groupsResp) => {
        this.onGroupsDataReceived_(props, groupsResp)
        return {succeed:true}
      }).catch((e) => {
        if (e?.cancelled){
          return { cancelled: true }
        }
        const errCode = e?.error_data?.error_reason?.error_code
        // Error code 6 - "too many requests per second"
        if (errCode !== 6){
          if (KNOWN_ERRORS.findIndex((v) => { return v === errCode }) === -1){
            log(e) 
          }
          if (DELETED_OR_CLOSED_ERRORS.findIndex((v) => { return v === errCode }) !== -1){
            props.incCounter('friendsProfileClosed')
          }
          props.incCounter('friendsErrorResponse')
          return { succeed: false, friendId: friendId, error: e.error_data?.error_reason?.error_msg ?? JSON.stringify(e)}
        }
        // If 10 times failed with "too many requests" error, then stop trying, perhaps there is a new problem.
        if (tryNum >= REQUEST_ATTEMPTS_COUNT_MAX){
          props.incCounter('attemptsCountExceeded')
          return { succeed: false, friendId: friendId, error: e.error_data?.error_reason?.error_msg ?? JSON.stringify(e)}
        }
        tryGetFriendsData(tryNum + 1)
      })
    }
    return tryGetFriendsData(0)
  }

  onFriendsDataReceived_ (props: any, resp: any) {
    props.incCounter('friendsCount', resp.response.count)
    const arr = [Promise.resolve(resp)]
    if (resp.response.count > FRIENDS_MAX_COUNT_PER_REQUEST){
      let params = {count: FRIENDS_MAX_COUNT_PER_REQUEST, offset: FRIENDS_MAX_COUNT_PER_REQUEST, user_id: props.fetchedUser?.id !== undefined? props.fetchedUser.id: null}
      const requestId = this.getRequestId_(props.fetchedUser?.id, FRIENDS_GET_METHOD_NAME, null, null, FRIENDS_MAX_COUNT_PER_REQUEST)
      arr.push(new Promise((resolve, reject) => {
        const GetMoreFriends = (tryNum: number) => {
          this.callAPI_(props, FRIENDS_GET_METHOD_NAME, requestId, params)
          .then(d => resolve(d))
          .catch(e => {
            const errCode = e?.error_data?.error_reason?.error_code
            if (errCode !== 6 || tryNum >= REQUEST_ATTEMPTS_COUNT_MAX){
              log('Non-repeatable error or attempts limit reached, tryNum ' + tryNum)
              log(e)
              reject(e)
              return
            }
            GetMoreFriends(tryNum + 1)
          })
        }
        GetMoreFriends(0)
      }))
    }
    return arr
  }

  onGroupsDataReceived_ (props: any, responseData: any) {
    if (!!responseData.response.items){
      responseData.response.items.forEach((g: any) => {
        let key = g.screen_name
        let obj = props.groupsData.get(key)
        if (obj){
          obj.friends++
        } else {
          props.groupsData.set(key, {name:g.name, friends: 1})
        }
      })
    }
    props.incCounter('friendsDataReceived')
    props.setCounter('groupsCount', props.groupsData.size)
    const hasMore = this.updateTopData(props.groupsData, props.topDataArr)
    props.setTopDataHasMore(hasMore)
  }
  
  timerCounter = 0
  scheduledTime_ms = 0
  callAPI_(props: any, method: string, requestId: string, params: any, new_scheduledTime_ms: any = null) {
    let request = {
      method: method, 
      request_id: requestId, 
      params: params
    }
    params["v"] = API_VERSION
    params["access_token"] = props.token
    const cancelToken = { id: this.timerCounter++, cancel: () => {} }
    // log(request)
    return new Promise((resolve, reject) => {
      // limit 3 requests per second for method 'groups.get'
      this.scheduledTime_ms = Math.max(new_scheduledTime_ms ?? this.scheduledTime_ms + API_REQUEST_INTERVAL, Date.now())
      let timeout = this.scheduledTime_ms - Date.now()
      props.timers.push(cancelToken)
      const timeoutId = setTimeout(() => {
        // log(request)
        props.incCounter('requestsSent')
        bridge.send("VKWebAppCallAPIMethod", request).then(data => {
          // log(data)
          resolve(data)
        }).catch(e => reject(e))
        .finally(() => {
          const ind = props.timers.findIndex((t:any) => t.id === cancelToken.id)
          if (ind !== -1){
            props.timers.splice(ind, 1)
            // log('timer ' + cancelToken.id + ' was removed from schedule')
          }
          else {
            warn('Warning: timer ' + cancelToken.id + ' was not found in schedule.timers')
          }
        })
      }, timeout)
      // log(`wait ${timeout} ms`)
      props.incCounter('requestsQueued')

      cancelToken.cancel = () => { 
        clearTimeout(timeoutId)
        reject({cancelled: true})
      }
    })
  }

  callAPIGetGroups_(props:any, friendId: number) { 
    return this.callAPI_(props, GROUPS_GET_MOTHOD_NAME, this.getRequestId_(props.fetchedUser?.id, GROUPS_GET_MOTHOD_NAME, friendId, 1), {
      user_id: friendId,
      extended: 1
    })
  }

  getRequestId_(fetchedUserid: any, method: string, user_id: any = null, extended: any = null, offset: Number = 0) {
    return `{"method":"${method}", "profileUserId":"${fetchedUserid}", "user_id":"${user_id? user_id : fetchedUserid}", "extended":"${extended}", "offset":"${offset}"}`
  }
  
  getUser(token: string, timers: any, incCounter: any, userName: string) {
    return this.callAPI_({token: token, timers: timers, incCounter: incCounter}, 
      "users.get", this.getRequestId_(null, USERS_GET_METHOD_NAME), 
      { user_ids: userName, fields: "photo_200, city, nickname"}, 0)
  }

  topDataKeys = new Set()
  updateTopData(groupsData: Map<any, any>, topDataArr: Array<any>): boolean {
    let i = 0
    const ent = groupsData.entries()
    const topDataMaxNum = topDataArr.length - 1
    while (i++ < groupsData.size){
      let newEl = ent.next()
      if (topDataArr[topDataMaxNum] === undefined || topDataArr[topDataMaxNum].value[1].friends < newEl.value[1].friends){
        if (this.topDataKeys.has(newEl.value[0])){
          for(let j = 0; j <= topDataMaxNum; j++)
          {
            if (topDataArr[j].value[0] === newEl.value[0]){
              if (topDataArr[j].value[1].friends !== newEl.value[1].friends){
                topDataArr[j].value[1].friends = newEl.value[1].friends
              }
              break
            }
          }
        } else {
          this.topDataKeys.add(newEl.value[0])
          let tmp = null
          for(let j = 0; j <= topDataMaxNum; j++){
            if (topDataArr[j] === undefined){
              topDataArr[j] = newEl
              break
            }
            if (topDataArr[j].value[1].friends < newEl.value[1].friends){
              tmp = topDataArr[j]
              topDataArr[j] = newEl
              newEl = tmp
            }
          }
          // exclude removable element key from set
          if (!!tmp){
            this.topDataKeys.delete(tmp.value[0])
          }
        }
        topDataArr.sort((a: any, b: any) => { if (b === undefined){ return -1} if (a === undefined){ return 1} return b.value[1].friends - a.value[1].friends })
      }
    }
    return groupsData.size > topDataMaxNum + 1
  }
}

export default VKDataService
export { API_REQUEST_INTERVAL }
export type { IVKDataService }