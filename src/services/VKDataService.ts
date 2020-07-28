import bridge from "@vkontakte/vk-bridge";
import log from "../logger"

const APP_ID = 7505513;
const APP_SCOPE = "friends, docs";
const API_VERSION = "5.110";
const FRIENDS_GET_REQEST_ID = "friends.get";
const GROUPS_GET_REQEST_ID = "groups.get";
const USERS_GET_REQEST_ID = "users.get";
const FRIENDS_MAX_COUNT_PER_REQUEST = 5000;
const REQUEST_ATTEMPTS_COUNT_MAX = 9;
const API_GROUPS_GET_REQUEST_INTERVAL = 350;
const KNOWN_ERRORS = [30, 7, 18, 29]

const createVKDataService = () => {
    const loadFriendsGroupsData = (props: any): Promise<Array<any>> => {
        return new Promise((resolve, reject) => {
            let params = { user_id: props.fetchedUser.id, count: FRIENDS_MAX_COUNT_PER_REQUEST }
            callAPI(props, "friends.get", getRequestId(props.fetchedUser?.id, FRIENDS_GET_REQEST_ID, null), params)
                .then((resp) => {
                    return onFriendsDataReceived(props, resp.response)
                })
                .catch(e => reject(e))
                .then((getFriendsPromises: any) => {
                    Promise.all(getFriendsPromises).then((friendsDataArr) => {
                        return friendsDataArr.map((friends: any) => {
                            return friends.items.map((friendId: number) => {
                                return new Promise((resolve) => {
                                    const tryGetFriendsData = (retryNum: number) => {
                                        const cancelToken = {};
                                        callAPIGetGroups(props, friendId, cancelToken).then((groupsResp) => {
                                            onGroupsDataReceived(props, groupsResp)
                                            resolve({succeed:true})
                                            props.schedule.timers.push(cancelToken)
                                        }).catch((e) => {
                                            const errCode = e?.error_data?.error_reason?.error_code
                                            // Error code 6 - "too many requests per second"
                                            if (errCode !== 6){
                                                if (!KNOWN_ERRORS.findIndex((v) => { return v === errCode })){
                                                    log(e) 
                                                }
                                                props.incCounter('friendsErrorResponse')                                            
                                                resolve({ succeed: false, friendId: friendId, error: e.error_data.error_reason.error_msg})                                            
                                                return
                                            }
                                            // If 10 times failed with "too many requests" error, then stop trying, perhaps there is a new problem.
                                            if (retryNum >= REQUEST_ATTEMPTS_COUNT_MAX){
                                                props.incCounter('attemptsCountExceeded')
                                                resolve({ succeed: false, friendId: friendId, error: e.error_data.error_reason.error_msg})                                            
                                                return
                                            }
                                            tryGetFriendsData(retryNum + 1)
                                        })
                                    }
                                    return tryGetFriendsData(0)
                                })
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
    
    const onFriendsDataReceived = (props: any, response: any) => {
        let friends = response.items;
        props.incCounter('friendsCount', friends.length);
        let friendsRequestOffset = 0;
        let res = [];
        while (friendsRequestOffset + FRIENDS_MAX_COUNT_PER_REQUEST < response.count){
            friendsRequestOffset += FRIENDS_MAX_COUNT_PER_REQUEST;
            let params = {count: FRIENDS_MAX_COUNT_PER_REQUEST, offset: friendsRequestOffset, user_id: props.fetchedUser?.id !== undefined? props.fetchedUser.id: null};
            const requestId = getRequestId(props.fetchedUser?.id, FRIENDS_GET_REQEST_ID, null, null, friendsRequestOffset)
            res.push(callAPI(props, FRIENDS_GET_REQEST_ID, requestId, params));
        }

        res.push(Promise.resolve(response))
        return res;        
    };

    const onGroupsDataReceived = (props: any, responseData: any) => {
        if (!!responseData.response.items){
            responseData.response.items.forEach((g: any) => {
                let key = g.screen_name;
                let obj = props.groupsData.get(key)
                if (obj){
                    obj.friends++
                } else {
                    props.groupsData.set(key, {name:g.name, friends: 1})
                }
            });
        };
        props.incCounter('friendsDataReceived')
        const {data, hasMore} = getUpdatedTopData(props.groupsData, props.topDataArr)
        props.setItems(data)
        props.setTopDataHasMore(hasMore)
    };
    
    const callAPI = (props: any, method: string, requestId: string, params: any) => { 
        let request = {
            method: method, 
            request_id: requestId, 
            params: params
        };
        params["v"] = API_VERSION
        params["access_token"] = props.token

        // log(request)
        return bridge.send("VKWebAppCallAPIMethod", request)
    }

    let scheduledTime_ms = 0;
    const callAPIGetGroups = (props:any, friendId: number, cancelToken: any) => { 
        return new Promise((resolve, reject) => {
            let request = {
                method: GROUPS_GET_REQEST_ID,
                request_id: getRequestId(props.fetchedUser?.id, GROUPS_GET_REQEST_ID, friendId, 1), 
                params: {
                    v: API_VERSION,
                    access_token: props.token,
                    user_id: friendId,
                    extended: 1
            }}

            // limit 3 requests per second for method 'groups.get'
            scheduledTime_ms = Math.max(scheduledTime_ms + API_GROUPS_GET_REQUEST_INTERVAL, Date.now())
            let timeout = scheduledTime_ms - Date.now()
            const timeoutId = setTimeout(() => {
                // log(request)
                props.incCounter('requestsSent')
                bridge.send("VKWebAppCallAPIMethod", request).then(data => resolve(data)).catch(e => reject(e))
            }, timeout)
            // log(`wait ${timeout} ms`)
            props.incCounter('requestsQueued')

            cancelToken.cancel = () => { 
                clearTimeout(timeoutId)
                reject(new Error("Cancelled")) 
            }
        })
    }

    const getRequestId = (fetchedUserid: number, method: string, user_id: any = null, extended: any = null, offset: Number = 0) => {
        return `{"method":"${method}", "profileUserId":"${fetchedUserid}", "user_id":"${user_id? user_id : fetchedUserid}", "extended":"${extended}", "offset":"${offset}"}`;
    }
    
    const changeProfile = (props: any, userName: any) => {
        callAPI(props, "users.get", getRequestId(props.fetchedUser?.id, USERS_GET_REQEST_ID), { user_ids: userName, fields: "photo_200, city, nickname"});
    };

    const topDataKeys = new Set()
    const getUpdatedTopData = (groupsData: Map<any, any>, topDataArr: Array<any>): any => {
        let i = 0
        const ent = groupsData.entries()
        const topDataMaxNum = topDataArr.length - 1;
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
                topDataArr.sort((a: any, b: any) => { if (b === undefined){ return -1;}; if (a === undefined){ return 1;}; return b.value[1].friends - a.value[1].friends; })
            };
        };
        return {data: topDataArr.slice(), hasMore: groupsData.size > topDataMaxNum + 1}
    }

    return {
        LoadInitialData: () => {
            return Promise.all([
				bridge.send('VKWebAppGetUserInfo'),
				bridge.send("VKWebAppGetAuthToken", {app_id: APP_ID, scope: APP_SCOPE})
			]);
        },
        LoadFriendsGroupsData: loadFriendsGroupsData,
        GetUpdatedTopData: getUpdatedTopData,
        ChangeProfile: changeProfile
    }
}

export default createVKDataService;