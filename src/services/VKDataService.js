import bridge from "@vkontakte/vk-bridge";

const createVKDataService = () => {
    const APP_ID = 7505513;
    const APP_SCOPE = "friends, docs";
    const API_VERSION = "5.110";
    const FRIENDS_GET_REQEST_ID = "friends.get";
    const GROUPS_GET_REQEST_ID = "groups.get";
    const USERS_GET_REQEST_ID = "users.get";
    const FRIENDS_MAX_COUNT_PER_REQUEST = 5000;
    const REQUEST_ATTEMPTS_COUNT_MAX = 3;

    let profileUserId = 0;
    let token = null;
    let onProgress = null;
    let onUpdateItems = null;
    let onSetUser = null;
    let onUserSearchFailed = null;
    let scheduledTime_ms = 0;
    let updateHasMore = null;

    let groupsData = null;
    let groupsDataStr = null;
    let friendsCount = 0;
    let friendsDataReceived = 0;
    let friendsRequestOffset = 0;
    let receivedFriendsResponse = false;

    let deletedOrClosedProfiles = [];
    let attemptsCountExceeded = 0;
    let friendsErrorResponse = 0;
    
    // let SKIP_PROFILES_IDS_KEY = '';
    // let GROUPS_DATA_KEY = '';

    let requestsQueued = 0;
    let requestsSent = 0;

    let userSawResults = false;

    let topData = [];
    let topDataKeys = new Set();
    let friendsRequestsData = new Map();
    let topDataCount = 0;

    // const CACHE_PREFIX = "AllFriends"

    // limit 3 requests per second for method 'groups.get'
    const API_GROUPS_GET_REQUEST_INTERVAL = 350;

    const getGroupsData = (userId, setProgress, setItems, setHasMore, topCount) => { 
        onProgress = setProgress;
        onUpdateItems = setItems;
        updateHasMore = setHasMore;
        topDataCount = topCount;

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
                // Save results
                // } else if (data.response?.upload_url){
                //     uploadResults(data.response?.upload_url);
                // } else {
                //     log('possible, upload response:')
                //     log(JSON.stringify(obj));
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
                    handleError(errorCode, params.user_id);
                    if (params.request_id.startsWith(USERS_GET_REQEST_ID)){
                        onUserSearchFailed(data);
                    } else if (params.request_id.startsWith(GROUPS_GET_REQEST_ID) && !registerFriendResponse(data.request_id)){
                        onProgress((friendsDataReceived + attemptsCountExceeded + ++friendsErrorResponse) * 100 / friendsCount);
                    };
                };
                break;
            default:
                break;
        };
        tryFinish();
    }

    const onTokenReceived = (data) => {
        token = data.access_token;
        let params = { user_id: profileUserId, count: FRIENDS_MAX_COUNT_PER_REQUEST, offset: friendsRequestOffset };
        callAPI("friends.get", `${FRIENDS_GET_REQEST_ID} ${profileUserId} ${friendsRequestOffset}`, params);

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
        if (friendsRequestsData.get(data.request_id)){
            return;
        };
        friendsRequestsData.set(data.request_id, {response_received: true});

        receivedFriendsResponse = true;
        let friends = data.response.items;
        friendsCount += friends.length;
        if (friendsCount === friends.length){
            let requestedFriendsCount = friendsCount;
            while (requestedFriendsCount < data.response.count){
                friendsRequestOffset += FRIENDS_MAX_COUNT_PER_REQUEST;                
                requestedFriendsCount += FRIENDS_MAX_COUNT_PER_REQUEST;
                let params = {count: FRIENDS_MAX_COUNT_PER_REQUEST, offset: friendsRequestOffset};
                if (profileUserId !== undefined){
                    params.user_id = profileUserId;
                };
                callAPI("friends.get", `${FRIENDS_GET_REQEST_ID} ${profileUserId} ${friendsRequestOffset}`, params);
            }
        }

        friends.forEach(friendId => {
            friendsRequestsData.set(friendId, { request: null, response_received: false, attemptsCount: 0});
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
                // from friends.get
                log("Error: rate limit reached, please, wait for one hour before calling api method again.")
                break;
            default:
                log('Error: unknown error');
                break;
        }
    }

    const onGroupsDataReceived = (data) => {
        if (!registerFriendResponse(data.request_id)){
            if (!!data.response.items){
                data.response.items.forEach((g) => {
                    let key = g.screen_name;
                    let obj = groupsData.get(key);
                    if (obj){
                        obj.friends++;
                    } else {
                        groupsData.set(key, {name:g.name, friends: 1});
                    }
                });
            };
            onProgress((++friendsDataReceived + attemptsCountExceeded + friendsErrorResponse) * 100 / friendsCount);
            updateTopData();
            onUpdateItems(topData);
            updateHasMore(groupsData.size > topData.length);
            log(`rS ${requestsSent}, rQ ${requestsQueued}, fC ${friendsCount}, fDR ${friendsDataReceived}, aCE ${attemptsCountExceeded}, fER ${friendsErrorResponse}`);
        }
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
            method: method, 
            request_id: requestId, 
            params: params
        };
        params["v"] = API_VERSION;
        params["access_token"] = token;

        if (requestId.startsWith(GROUPS_GET_REQEST_ID)){
            scheduledTime_ms = Math.max(scheduledTime_ms + API_GROUPS_GET_REQUEST_INTERVAL, Date.now());
            let timeout = scheduledTime_ms - Date.now();
            setTimeout(() => {
                log(request);
                log(bridge.send("VKWebAppCallAPIMethod", request));
                requestsSent++;
                let userId = parseInt(request.params.user_id);
                let reqInfo = friendsRequestsData.get(userId);
                reqInfo.attemptsCount++;
                reqInfo.request = request;
                setTimeout(() => {
                    if (!reqInfo.response_received){
                        if (reqInfo.attemptsCount < REQUEST_ATTEMPTS_COUNT_MAX){
                            log(`response not received, userId ${userId}, repeat.`);
                            callAPI(reqInfo.request.method, reqInfo.request.request_id, reqInfo.request.params);
                        }
                        else{
                            log(`Attempts exceeded requesting groups for user ${userId}.`);
                            onProgress((friendsDataReceived + ++attemptsCountExceeded + friendsErrorResponse) * 100 / friendsCount);
                            reqInfo.attemptsCountExceeded = true;
                        };
                    }
                }, Math.max(scheduledTime_ms, Date.now() + 3000) - Date.now());
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
    
    const registerFriendResponse = (requestId) => {
        let userId = requestId.split(' ')[1].split(':')[1];
        let reqData = friendsRequestsData.get(parseInt(userId));
        let val = reqData.response_received || reqData.attemptsCountExceeded;
        reqData.response_received = true;
        return val;
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

    const updateTopData = () => {
        let entr = groupsData.entries();
        let i = 0;
        let topDataMaxNum = topDataCount - 1;
        while (i++ < groupsData.size){
            let newEl = entr.next();
            if (topData[topDataMaxNum] === undefined || topData[topDataMaxNum].value[1].friends < newEl.value[1].friends){
                // log(JSON.stringify(newEl));
                if (topDataKeys.has(newEl.value[0])){
                    for(let j = 0; j <= topDataMaxNum; j++)
                    {
                        if (topData[j].value[0] === newEl.value[0]){
                            if (topData[j].value[1].friends !== newEl.value[1].friends){
                                topData[j].value[1].friends = newEl.value[1].friends;
                            };
                            break;
                        };
                    };
                } else {
                    topDataKeys.add(newEl.value[0]);
                    let tmp = null;
                    for(let j = 0; j <= topDataMaxNum; j++){
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
                topData.sort((a, b) => { if (b === undefined){ return -1;}; if (a === undefined){ return 1;}; return b.value[1].friends - a.value[1].friends; });
            };
        };
        return topData;
    }
    
    const tryFinish = () => {
        if (!userSawResults 
            && receivedFriendsResponse 
            && ((friendsDataReceived + attemptsCountExceeded + friendsErrorResponse) === friendsCount) 
            && requestsSent === requestsQueued){
            userSawResults = true;
            // callAPI("docs.getUploadServer", "docs.getUploadServer", {});
            // bridge.unsubscribe(listener);
            log(`requestsSent = ${requestsSent}`);
            log(`requestsQueued = ${requestsQueued}`);
            log(`friendsCount = ${friendsCount}`);
            log(`friendsDataReceived = ${friendsDataReceived}`);
            log(`attemptsCountExceeded = ${attemptsCountExceeded}`);
            log(`friendsErrorResponse = ${friendsErrorResponse}`);
            let groupsDataArr = Array.from(groupsData.entries()).sort((a, b) => { return b[1].friends - a[1].friends; }).map((e) => { return {value:[e[0], e[1]] }});
            groupsDataStr = JSON.stringify(groupsDataArr);//.map((e) => {return [e.value[0], e.value[1].name, e.value[1].friends];}));
            log(groupsDataStr);
            log(JSON.stringify(Array.from(friendsRequestsData.entries())));
            updateHasMore(false);
            onUpdateItems(groupsDataArr);
        };
    }

    async function uploadResults(url) {
        let formData = new FormData();
        formData.append("file", new Blob(["groupsDataStr"], {type : 'application/json'}), "file.json");
        fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            body: formData,
            headers:{
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "X-Requested-With, content-type"
            }
        }).then((blob) => {
            let uploadFileInfo = blob;
            log('uploadFileInfo');
            log(uploadFileInfo);
            callAPI("docs.save", "docs.save", {file: uploadFileInfo.file, title: `All_friends_groups_user_id_${profileUserId}_${Date.now()}.json`});
            // bridge.send("docs.save", {file: uploadFileInfo.file, title: `All_friends_groups_user_id_${profileUserId}_${Date.now()}.json`});
        });
        // let uploadFileInfo = await response.json();
        // result.message;
    };

    const getUserInfo = (userName) => { 
        return new Promise((resolve, reject) => {
            callAPI("users.get", USERS_GET_REQEST_ID, { user_ids: userName, fields: "photo_200, city, nickname"});
            onSetUser = resolve;
            onUserSearchFailed = reject;
        });
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
