// Copyright © 2020 Farkhad Muminov. All rights reserved.
import bridge from "@vkontakte/vk-bridge"
import log from "../logger"

const APP_ID = 7505513
const APP_SCOPE = "friends, docs"
const API_VERSION = "5.110"
const FRIENDS_GET_REQEST_ID = "friends.get"
const GROUPS_GET_REQEST_ID = "groups.get"
const USERS_GET_REQEST_ID = "users.get"
const FRIENDS_MAX_COUNT_PER_REQUEST = 5000
const REQUEST_ATTEMPTS_COUNT_MAX = 9
const API_REQUEST_INTERVAL = 350
const KNOWN_ERRORS = [30, 7, 18, 29]

const createVKDataService = () => {
    const loadFriendsGroupsData = (props: any): Promise<Array<any>> => {
        return new Promise((resolve) => {
            // let friendNum = 0
            let params = { user_id: props.fetchedUser.id, count: FRIENDS_MAX_COUNT_PER_REQUEST }
            callAPI(props, "friends.get", getRequestId(props.fetchedUser?.id, FRIENDS_GET_REQEST_ID, null), params)
                .then((resp: any) => {
                    return onFriendsDataReceived(props, resp)
                })
                .then((getFriendsPromises: any) => {
                    Promise.all(getFriendsPromises).then((friendsDataArr) => {
                        props.hideSpinner()
                        return friendsDataArr.map((friendsResp: any) => friendsResp.response.items).flat()
                            .map((friendId: any) => {
                                return new Promise((resolve) => {
                                    const tryGetFriendsData = (tryNum: number) => {
                                        callAPIGetGroups(props, friendId).then((groupsResp) => {
                                            onGroupsDataReceived(props, groupsResp)
                                            resolve({succeed:true})
                                        }).catch((e) => {
                                            if (e?.cancelled){
                                                resolve({ cancelled: true })
                                                return
                                            }
                                            const errCode = e?.error_data?.error_reason?.error_code
                                            // Error code 6 - "too many requests per second"
                                            if (errCode !== 6){
                                                if (KNOWN_ERRORS.findIndex((v) => { return v === errCode }) === -1){
                                                    log(e) 
                                                }
                                                props.incCounter('friendsErrorResponse')
                                                resolve({ succeed: false, friendId: friendId, error: e.error_data?.error_reason?.error_msg ?? JSON.stringify(e)})
                                                return
                                            }
                                            // If 10 times failed with "too many requests" error, then stop trying, perhaps there is a new problem.
                                            if (tryNum >= REQUEST_ATTEMPTS_COUNT_MAX){
                                                props.incCounter('attemptsCountExceeded')
                                                resolve({ succeed: false, friendId: friendId, error: e.error_data?.error_reason?.error_msg ?? JSON.stringify(e)})
                                                return
                                            }
                                            tryGetFriendsData(tryNum + 1)
                                        })
                                    }
                                    return tryGetFriendsData(0)
                                })
                            })
                    })
                    .then((groupsPromises: any[]) => {
                        Promise.all(groupsPromises.flat()).then(_ => {
                            // log('failed users:')
                            // log(results.filter((res: any) => !res.succeed).map((res: any) => 'userId: ' + res.friendId + ', error: ' + res.error))
                            resolve(_)
                        })
                    })
                })
            })
    }

    const onFriendsDataReceived = (props: any, resp: any) => {
        props.incCounter('friendsCount', resp.response.count)
        const arr = []
        if (resp.response.count > FRIENDS_MAX_COUNT_PER_REQUEST){
            let params = {count: FRIENDS_MAX_COUNT_PER_REQUEST, offset: FRIENDS_MAX_COUNT_PER_REQUEST, user_id: props.fetchedUser?.id !== undefined? props.fetchedUser.id: null}
            const requestId = getRequestId(props.fetchedUser?.id, FRIENDS_GET_REQEST_ID, null, null, FRIENDS_MAX_COUNT_PER_REQUEST)
            arr.push(new Promise((resolve, reject) => {
                const GetMoreFriends = (tryNum: number) => {
                    callAPI(props, FRIENDS_GET_REQEST_ID, requestId, params)
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
        arr.push(Promise.resolve(resp))
        return arr
    }

    const onGroupsDataReceived = (props: any, responseData: any) => {
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
        const hasMore = updateTopData(props.groupsData, props.topDataArr)
        props.setTopDataHasMore(hasMore)
    }
    
    let timerCounter = 0
    let scheduledTime_ms = 0
    const callAPI = (props: any, method: string, requestId: string, params: any, new_scheduledTime_ms: any = null) => { 
        let request = {
            method: method, 
            request_id: requestId, 
            params: params
        }
        params["v"] = API_VERSION
        params["access_token"] = props.token
        const cancelToken = { id: timerCounter++, cancel: () => {} }
        // log(request)
        return new Promise((resolve, reject) => {
            // limit 3 requests per second for method 'groups.get'
            scheduledTime_ms = Math.max(new_scheduledTime_ms ?? scheduledTime_ms + API_REQUEST_INTERVAL, Date.now())
            let timeout = scheduledTime_ms - Date.now()
            props.timers.push(cancelToken)
            const timeoutId = setTimeout(() => {
                // log(request)
                props.incCounter('requestsSent')
                bridge.send("VKWebAppCallAPIMethod", request).then(data => {
                    const ind = props.timers.findIndex((t:any) => t.id === cancelToken.id)
                    if (ind !== -1){
                        props.timers.splice(ind, 1)
                        // log('timer ' + cancelToken.id + ' was removed from schedule')
                    }
                    else {
                        // warn('Warning: timer ' + cancelToken.id + ' was not found in schedule.timers')
                    }
                    resolve(data)
                }).catch(e => reject(e))
            }, timeout)
            // log(`wait ${timeout} ms`)
            props.incCounter('requestsQueued')

            cancelToken.cancel = () => { 
                clearTimeout(timeoutId)
                reject({cancelled: true})
            }
        })
    }

    const callAPIGetGroups = (props:any, friendId: number) => { 
        return callAPI(props, GROUPS_GET_REQEST_ID, getRequestId(props.fetchedUser?.id, GROUPS_GET_REQEST_ID, friendId, 1), {
            user_id: friendId,
            extended: 1
        })
    }

    const getRequestId = (fetchedUserid: any, method: string, user_id: any = null, extended: any = null, offset: Number = 0) => {
        return `{"method":"${method}", "profileUserId":"${fetchedUserid}", "user_id":"${user_id? user_id : fetchedUserid}", "extended":"${extended}", "offset":"${offset}"}`
    }
    
    const getUser = (token: string, timers: any, incCounter: any, userName: string) => {
        return callAPI({token: token, timers: timers, incCounter: incCounter}, "users.get", getRequestId(null, USERS_GET_REQEST_ID), { user_ids: userName, fields: "photo_200, city, nickname"}, 0)
    }

    const topDataKeys = new Set()
    const updateTopData = (groupsData: Map<any, any>, topDataArr: Array<any>): any => {
        let i = 0
        const ent = groupsData.entries()
        const topDataMaxNum = topDataArr.length - 1
        while (i++ < groupsData.size){
            let newEl = ent.next()
            if (topDataArr[topDataMaxNum] === undefined || topDataArr[topDataMaxNum].value[1].friends < newEl.value[1].friends){
                if (topDataKeys.has(newEl.value[0])){
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
                    topDataKeys.add(newEl.value[0])
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
                        topDataKeys.delete(tmp.value[0])
                    }
                }
                topDataArr.sort((a: any, b: any) => { if (b === undefined){ return -1} if (a === undefined){ return 1} return b.value[1].friends - a.value[1].friends })
            }
        }
        return groupsData.size > topDataMaxNum + 1
    }

    return {
        LoadInitialData: () => {
            return Promise.all([
				bridge.send('VKWebAppGetUserInfo'),
				bridge.send("VKWebAppGetAuthToken", {app_id: APP_ID, scope: APP_SCOPE})
			])
        },
        LoadFriendsGroupsData: loadFriendsGroupsData,
        UpdateTopData: updateTopData,
        GetUser: getUser
    }
}

export default createVKDataService
export { API_REQUEST_INTERVAL }