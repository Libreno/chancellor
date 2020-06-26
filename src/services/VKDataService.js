import bridge from "@vkontakte/vk-bridge";

const createVKDataService = () => {
    const APP_ID = 7505513;
    const APP_SCOPE = "friends";
    const API_VERSION = "5.110";
    const FRIENDS_GET_REQEST_ID = "friends.get";
    const GROUPS_GET_REQEST_ID = "groups.get";
    const USERS_GET_REQEST_ID = "users.get";
    const FRIENDS_MAX_COUNT_PER_REQUEST = 5000;
    const TOP_DATA_MAX_NUM = 9;

    let profileUserId = 0;
    let token = null;
    let onProgress = null;
    let onUpdateItems = null;
    let onSetUser = null;
    let scheduledTime_ms = 0;

    let groupsData = null;
    let friendsCount = 0;
    let friendsDataReceived = 0;
    let friendsRequestOffset = 0;

    let deletedOrClosedProfiles = [];

    // let SKIP_PROFILES_IDS_KEY = '';
    // let GROUPS_DATA_KEY = '';

    let requestsQueued = 0;
    let requestsSent = 0;

    let statisticsShowPlanned = false;

    let topData = [];
    let topDataKeys = new Set();

    // const CACHE_PREFIX = "AllFriends"

    // limit 3 requests per second for method 'groups.get'
    const API_GROUPS_GET_REQUEST_INTERVAL = 350;

    const getGroupsData = (userId, setProgress, setItems) => { 
        onProgress = setProgress;
        onUpdateItems = setItems;
        groupsData = new Map();

        profileUserId = userId;
        // SKIP_PROFILES_IDS_KEY = `${profileUserId} deletedOrClosedProfiles`
        // GROUPS_DATA_KEY = `${profileUserId} groupsData`;

        // let val = getFromCache(GROUPS_DATA_KEY);
        // if (!!val){
        //     return;
        // };

        // deletedOrClosedProfiles = getFromCache(SKIP_PROFILES_IDS_KEY) ?? deletedOrClosedProfiles;

        bridge.subscribe(listener);
        if (!token){
            bridge.send("VKWebAppGetAuthToken", {app_id: APP_ID, scope: APP_SCOPE});
        }
        else {
            onTokenReceived({access_token: token});
        }
    };

    const listener = (obj) => {
        log(obj);
        let { detail: { type, data }} = obj;
        switch (type){
            case ("VKWebAppAccessTokenReceived"):
                onTokenReceived(data);
                break;
            case ("VKWebAppCallAPIMethodResult"):
                // if (!getFromCache(data.request_id)){
                //     saveToCache(data, data.request_id);
                // };
                if (data.request_id.startsWith(FRIENDS_GET_REQEST_ID)){
                    onFriendsDataReceived(data);
                } else if (data.request_id.startsWith(GROUPS_GET_REQEST_ID)){
                    onGroupsDataReceived(data);
                } else if (data.request_id.startsWith(USERS_GET_REQEST_ID)){
                    onSetUser(data);
                };
                break;
            case ("VKWebAppCallAPIMethodFailed"):
                let params = data.error_data.error_reason.request_params.reduce((o, cv) => {o[cv.key] = cv.value; return o;}, {});
                let errorCode = data.error_data.error_reason.error_code;
                if (errorCode === 6){
                    // In case of error: too many requests per second - reschedule the request
                    log('repeat request')
                    callAPI(params.method, params.request_id, params);
                }
                else {
                    onProgress(++friendsDataReceived * 100 / friendsCount);
                    handleError(errorCode, params.user_id);
                };
                break;
            default:
                break;
        };
    }

    const onTokenReceived = (data) => {
        token = data.access_token;
        callAPI("friends.get", FRIENDS_GET_REQEST_ID, { user_id: profileUserId, count: FRIENDS_MAX_COUNT_PER_REQUEST, offset: friendsRequestOffset });

        // let requestId = getRequestId(FRIENDS_GET_REQEST_ID, profileUserId, undefined, FRIENDS_MAX_COUNT_PER_REQUEST, friendsRequestOffset);
        // let dataCached = getFromCache(requestId);
        // if (!!dataCached){
        //     onFriendsDataReceived(dataCached);
        // } 
        // else {
            // callAPI("friends.get", requestId, profileUserId === undefined? {} : { "user_id": profileUserId, "count": FRIENDS_MAX_COUNT_PER_REQUEST, "offset": friendsRequestOffset });
        // }
    };

    const onFriendsDataReceived = (data) => {
        let friends = data.response.items;
        friendsCount += friends.length;
        if (friendsCount === friends.length){
            let requestedFriendsCount = friendsCount;
            while (requestedFriendsCount < data.response.count){
                friendsRequestOffset += FRIENDS_MAX_COUNT_PER_REQUEST;
                requestedFriendsCount += FRIENDS_MAX_COUNT_PER_REQUEST;
                callAPI("friends.get", FRIENDS_GET_REQEST_ID, profileUserId === undefined? {} : { user_id: profileUserId, count: FRIENDS_MAX_COUNT_PER_REQUEST, offset: friendsRequestOffset });
            }
        }

        friends.forEach(friendId => {
            if (deletedOrClosedProfiles.indexOf(friendId) !== -1){
                return;
            };
            let requestId = getRequestId(GROUPS_GET_REQEST_ID, friendId, 1);
            // let dataCached = getFromCache(requestId);
            // if (!!dataCached){
            //     onGroupsDataReceived(dataCached);
            // }
            // else {
                callAPI("groups.get", requestId, { user_id:  friendId, extended: 1});
            // }
        });
    };

    const handleError = (errorCode, userId) => {
        switch(errorCode){
            case 30:
            case 7:
            case 18:
                log(`Info: private or deleted profile or groups are hidden by user ${userId}`);
                deletedOrClosedProfiles.push(userId);
                break;
            case 29:
                log("Error: rate limit reached, please, wait for one hour before calling api method again.")
                break;
            default:
                log('Error: unknown error');
                break;
        }
    }

    const onGroupsDataReceived = (data) => {
        if (!!data.response.items){
            data.response.items.forEach((g) => {
                let key = g.id;
                let obj = groupsData.get(key);
                groupsData.set(key, {name:g.name, friends: (!!obj)? obj.friends + 1 : 1});
            });
        };
        onProgress(++friendsDataReceived * 100 / friendsCount);
        onUpdateItems(getTopData());
        if (!statisticsShowPlanned && requestsQueued === requestsSent){
            statisticsShowPlanned = true;
            finish();
        };
    };

    const log = (message) => {
        var today = new Date();
        var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + ":" + today.getMilliseconds();
        if (typeof message === 'object'){
            console.log(`${time} =>`);
            console.log(message);
        } else {
            console.log(`${time} => ${message}`);
        }
    };

    const callAPI = (method, requestId, params) => { 
        let request = {
            "method": method, 
            "request_id": requestId, 
            "params": params
        };
        params["v"] = API_VERSION;
        params["access_token"] = token;

        if (requestId.startsWith(GROUPS_GET_REQEST_ID)){
            scheduledTime_ms = Math.max(scheduledTime_ms + API_GROUPS_GET_REQUEST_INTERVAL, Date.now());
            let timeout = scheduledTime_ms - Date.now();
            setTimeout(() => {
                log(request);
                bridge.send("VKWebAppCallAPIMethod", request);
                requestsSent++;
            }, timeout);
            log(`wait ${timeout} ms`);
            requestsQueued++;
        }
        else{
            log(request);
            bridge.send("VKWebAppCallAPIMethod", request);
        }
    };

    const getRequestId = (method, user_id, extended, count, offset) => {
        return `${method} user_id:${user_id} extended:${extended} api_ver:${API_VERSION} appId:${APP_ID} scope:${APP_SCOPE} count: ${count} offset: ${offset}`;
    }
    
    // const getFromCache = (request_id) => {
        // let fullKey = `${CACHE_PREFIX} ${request_id}`;
        // let dataCached = sessionStorage.getItem(fullKey);
        // if (!dataCached){
        //     return;
        // };
        // log(`Data loaded from sessionStorage with key '${fullKey}'.`)
        // let dataParsed = JSON.parse(dataCached);
        // log(dataParsed);
        // return dataParsed;
    // }

    // const saveToCache = (groupsDataArr, request_id) => {
        // try {
        //     let strData = JSON.stringify(groupsDataArr);
        //     log(`Trying to save string with ${strData.length} chars in sessionStorage.`);
        //     sessionStorage.setItem(`${CACHE_PREFIX} ${request_id}`, strData);
        //     log(`Data saved successfully!`);
        // }
        // catch (e) {
        //     log(e);
        // };
    // };

    const getTopData = () => {
        let entr = groupsData.entries();
        let i = 0;
        while (i++ < groupsData.size){
            let newEl = entr.next();
            if (topData[TOP_DATA_MAX_NUM] === undefined || topData[TOP_DATA_MAX_NUM].value[1].friends < newEl.value[1].friends){
                if (topDataKeys.has(newEl.value[0])){
                    for(let j = 0; j <= TOP_DATA_MAX_NUM; j++)
                    {
                        if (topData[j].value[0] === newEl.value[0]){
                            if (topData[j].value[1].friends === newEl.value[1].friends){
                                break;
                            };
                            topData[j].value[1].friends = newEl.value[1].friends;
                            topData.sort((a, b) => { if (b === undefined){ return -1;}; if (a === undefined){ return 1;}; return b.value[1].friends - a.value[1].friends; });
                            break;
                        };
                    };
                } else {
                    topDataKeys.add(newEl.value[0]);
                    let tmp = null;
                    for(let j = 0; j <= TOP_DATA_MAX_NUM; j++){
                        if (topData[j] === undefined){
                            topData[j] = newEl;
                            break;
                        };
                        if (topData[j].value[1].friends < newEl.value[1].friends){
                            tmp = topData[j];
                            topData[j] = newEl;
                            newEl = tmp;
                        }
                    };
                    // exclude removable element key from set
                    if (!!tmp){
                        topDataKeys.delete(tmp.value[0]);
                    };
                };
            };
        };
        return topData;
    }
    
    function finish() {
        // bridge.unsubscribe(listener);
        log(`requestsSent = ${requestsSent}`);
        log(`requestsQueued = ${requestsQueued}`);
        log(`friendsCount = ${friendsCount}`);
        log(`friendsDataReceived = ${friendsDataReceived}`);
        let groupsDataArr = Array.from(groupsData.entries()).sort((a, b) => { return b[1].friends - a[1].friends; });
        log(groupsDataArr);
    }

    const getUserInfo = (userName, setUser) => { 
        callAPI("users.get", USERS_GET_REQEST_ID, { "user_ids": userName });
        onSetUser = setUser;
    };

    return {
        Init: () => {return bridge.send("VKWebAppInit")},
        GetCurrentUserInfo: () => { return bridge.send('VKWebAppGetUserInfo')},
        GetUserInfo: getUserInfo,
        GetGroupsData: getGroupsData,
    }
}

const VKDataService = createVKDataService();

export default VKDataService;
