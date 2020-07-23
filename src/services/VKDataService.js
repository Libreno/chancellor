import bridge from "@vkontakte/vk-bridge";

const APP_ID = 7505513;
const APP_SCOPE = "friends, docs";
const API_VERSION = "5.110";
const FRIENDS_GET_REQEST_ID = "friends.get";
const GROUPS_GET_REQEST_ID = "groups.get";
const USERS_GET_REQEST_ID = "users.get";
const FRIENDS_MAX_COUNT_PER_REQUEST = 5000;
const REQUEST_ATTEMPTS_COUNT_MAX = 3;
const API_GROUPS_GET_REQUEST_INTERVAL = 350;

const createVKDataService = () => {
    function loadGroupsData(props) {
        bridge.subscribe((obj) => {listener(props, obj)});

        if (!props.token){
            bridge.send("VKWebAppGetAuthToken", {app_id: APP_ID, scope: APP_SCOPE});
        }
        else {
            loadFriendsFirstRequest({access_token: props.token});
        }
    };

    function listener(props, obj) {
        props.log(obj);
        let { detail: { type, data }} = obj;
        if (data.request_id){
            let requestIdObj = JSON.parse(data.request_id);
            if (!!requestIdObj.profileUserId && Number(requestIdObj.profileUserId) !== Number(props.fetchedUser.id)){
                props.log(`response for profile ${requestIdObj.profileUserId} skipped, current profile ${props.fetchedUser.id}.`);
                return;
            };
        };

        switch (type){
            case ("VKWebAppAccessTokenReceived"):
                props.setToken(data.access_token);
                loadFriendsFirstRequest(props);
                break;
            case ("VKWebAppCallAPIMethodResult"):
                handleAPIResult(props, data);
                break;
            case ("VKWebAppCallAPIMethodFailed"):
                let params = data.error_data.error_reason.request_params.reduce((o, cv) => {o[cv.key] = cv.value; return o;}, {});
                let errorCode = data.error_data.error_reason.error_code;
                if (errorCode === 6){
                    // In case of error: too many requests per second - reschedule the request
                    props.log('repeat request')
                    callAPI(props, params.method, params.request_id, params);
                }
                else {
                    let requestIdObj = JSON.parse(params.request_id);
                    handleError(props, errorCode, params.user_id);
                    if (requestIdObj.method === USERS_GET_REQEST_ID){
                        props.onUserSearchFailed(data);
                    } else if (requestIdObj.method === GROUPS_GET_REQEST_ID && !registerFriendResponse(props, data.request_id)){
                            props.incCounter('friendsErrorResponse');
                    };
                };
                break;
            case ("VKWebAppGetUserInfoResult"):
                props.setUser(data);
                props.cleanState();
                loadFriendsFirstRequest(props);
                props.log("VKWebAppGetUserInfoResult");
                break;
            default:
                props.log(`Warning: unhandledresponse type ` + type);
                break;
        };
        tryFinish(props);
    }

    const loadFriendsFirstRequest = (props) => {
        let params = { user_id: props.fetchedUser.id, count: FRIENDS_MAX_COUNT_PER_REQUEST };
        callAPI(props, "friends.get", getRequestId(FRIENDS_GET_REQEST_ID), params);
    };
    
    const handleAPIResult = (props, data) => {
        let requestIdObj = JSON.parse(data.request_id);
        switch (requestIdObj.method) {
            case (FRIENDS_GET_REQEST_ID):
                onFriendsDataReceived(props, data);
                break;
            case (GROUPS_GET_REQEST_ID):
                onGroupsDataReceived(props, data);
                break;
            case (USERS_GET_REQEST_ID):
                props.setUser(data);
                break;
            default:
                props.log(`Error: wrong request id ` + data.request_id);
                break;
        };
    }

    const onFriendsDataReceived = (props, data) => {
        if (props.friendsRequestsData.get(data.request_id)){
            return;
        };
        props.log('friendsRequestsData set ' + data.request_id)
        props.friendsRequestsData.set(data.request_id, {response_received: true});

        let friends = data.response.items;
        props.incCounter('friendsCount', friends.length);
        let friendsRequestOffset = 0;
        while (friendsRequestOffset + FRIENDS_MAX_COUNT_PER_REQUEST < data.response.count){
            friendsRequestOffset += FRIENDS_MAX_COUNT_PER_REQUEST;
            let params = {count: FRIENDS_MAX_COUNT_PER_REQUEST, offset: friendsRequestOffset};
            if (props.fetchedUser?.id !== undefined){
                params.user_id = props.fetchedUser.id;
            };
            callAPI("friends.get", getRequestId(FRIENDS_GET_REQEST_ID, null, null, friendsRequestOffset), params);
        }

        friends.forEach(friendId => {
            props.log('friendsRequestsData set ' + friendId)
            props.friendsRequestsData.set(friendId, { request: null, response_received: false, attemptsCount: 0});
            // if (deletedOrClosedProfiles.indexOf(friendId) !== -1){
            //     return;
            // };
            callAPI("groups.get", getRequestId(GROUPS_GET_REQEST_ID, friendId, 1), { user_id:  friendId, extended: 1});
        });
    };

    const handleError = (props, errorCode, userId) => {
        switch(errorCode){
            case 30:
            case 7:
            case 18:
                props.log(`Info: private or deleted profile or groups are hidden by user ${userId}`);
                // deletedOrClosedProfiles.push(userId);
                break;
            case 29:
                // from friends.get
                props.log("Error: rate limit reached, please, wait for one hour before calling api method again.")
                break;
            default:
                props.log('Error: unknown error');
                break;
        }
    }

    const onGroupsDataReceived = (props, data) => {
        if (!registerFriendResponse(props, data.request_id)){
            if (!!data.response.items){
                data.response.items.forEach((g) => {
                    let key = g.screen_name;
                    let obj = props.groupsData.get(key);
                    if (obj){
                        obj.friends++;
                    } else {
                        props.groupsData.set(key, {name:g.name, friends: 1});
                    }
                });
            };
            props.incCounter('friendsDataReceived');
            updateTopData(props);
            props.updateItems(props.topData);
            props.setTopData({ hasMore: props.groupsData.size > props.topData.length });
        }
    };
    
    const callAPI = (props, method, requestId, params) => { 
        let request = {
            method: method, 
            request_id: requestId, 
            params: params
        };
        params["v"] = API_VERSION;
        params["access_token"] = props.token;

        // limit 3 requests per second for method 'groups.get'
        if (method === GROUPS_GET_REQEST_ID){
            let scheduledTime_ms = props.schedule.scheduledTime_ms;
            let timers = props.schedule.timers;
            scheduledTime_ms = Math.max(scheduledTime_ms + API_GROUPS_GET_REQUEST_INTERVAL, Date.now());
            let timeout = scheduledTime_ms - Date.now();
            timers.push(setTimeout(() => {
                props.log(request);
                bridge.send("VKWebAppCallAPIMethod", request);
                props.incCounter('requestsSent');
                let userId = parseInt(request.params.user_id);
                let reqInfo = props.friendsRequestsData.get(userId);
                reqInfo.attemptsCount++;
                reqInfo.request = request;
                timers.push(setTimeout(() => {
                    if (!reqInfo.response_received){
                        if (reqInfo.attemptsCount < REQUEST_ATTEMPTS_COUNT_MAX){
                            props.log(`response not received, userId ${userId}, repeat.`);
                            callAPI(reqInfo.request.method, reqInfo.request.request_id, reqInfo.request.params);
                        }
                        else{
                            props.log(`Attempts exceeded requesting groups for user ${userId}.`);
                            props.incCounter('attemptsCountExceeded');
                            // updateProgress((friendsDataReceived + ++attemptsCountExceeded + friendsErrorResponse) * 100 / friendsCount);
                            reqInfo.attemptsCountExceeded = true;
                        };
                    }
                }, Math.max(scheduledTime_ms, Date.now() + 3000) - Date.now()));
            }, timeout));
            props.log(`wait ${timeout} ms`);
            props.incCounter('requestsQueued');
        }
        else{
            props.log(request);
            bridge.send("VKWebAppCallAPIMethod", request);
        }
    };

    const getRequestId = (props, method, user_id, extended, offset) => {
        return `{"method":"${method}", "profileUserId":"${props.fetchedUser.id}", "user_id":"${user_id? user_id : props.fetchedUser?.id}", "extended":"${extended}", "offset":"${offset}"}`;
    }
    
    const registerFriendResponse = (props, requestId) => {
        let requestIdObj = JSON.parse(requestId);
        let reqData = props.friendsRequestsData.get(parseInt(requestIdObj.user_id));
        if (!reqData){
            props.log('reqData ' + requestId);
            props.log('requestIdObj.user_id ' + requestIdObj.user_id);
            props.log(JSON.stringify(Array.from(props.friendsRequestsData.entries())));
        }
        let val = reqData?.response_received || reqData?.attemptsCountExceeded;
        reqData.response_received = true;
        return val;
    }

    const updateTopData = (props) => {
        let entr = props.groupsData.entries();
        let i = 0;
        let topData = props.topData.arr;
        let topDataMaxNum = props.topData.count - 1;
        let topDataKeys = props.topData.keys;
        while (i++ < props.groupsData.size){
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
    
    const tryFinish = (props) => {
        if (props.readyToFinish()){
            props.incCounter('userSawResults');
            // callAPI("docs.getUploadServer", "docs.getUploadServer", {});
            // bridge.unsubscribe(listener);
            // log(`requestsSent = ${counters.requestsSent}`);
            // log(`requestsQueued = ${counters.requestsQueued}`);
            // log(`friendsCount = ${counters.friendsCount}`);
            // log(`friendsDataReceived = ${counters.friendsDataReceived}`);
            // log(`attemptsCountExceeded = ${counters.attemptsCountExceeded}`);
            // log(`friendsErrorResponse = ${counters.friendsErrorResponse}`);
            let groupsDataArr = Array.from(props.groupsData.entries()).sort((a, b) => { return b[1].friends - a[1].friends; }).map((e) => { return {value:[e[0], e[1]] }});
            window.groupsDataArr = groupsDataArr;
            // groupsDataStr = JSON.stringify(groupsDataArr);//.map((e) => {return [e.value[0], e.value[1].name, e.value[1].friends];}));
            // log(groupsDataStr);
            // log(JSON.stringify(Array.from(friendsRequestsData.entries())));
            props.setTopData({ hasMore: false });
            props.setItems(groupsDataArr);
        };
    }

    async function uploadResults(props, url) {
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
            props.log('uploadFileInfo');
            props.log(uploadFileInfo);
            callAPI("docs.save", "docs.save", {file: uploadFileInfo.file, title: `All_friends_groups_user_id_${props.fetchedUser?.id}_${Date.now()}.json`});
            // bridge.send("docs.save", {file: uploadFileInfo.file, title: `All_friends_groups_user_id_${profileUserId}_${Date.now()}.json`});
        });
        // let uploadFileInfo = await response.json();
        // result.message;
    };

    // const incCounters = (newCounters) => {
    //     updateCounters(Object.assign({}, counters, newCounters));
        //     {
        //     requestsQueued        : newCounters.requestsQueued         ? newCounters.requestsQueued        : counters.requestsQueued,
        //     requestsSent          : newCounters.requestsSent           ? newCounters.requestsSent          : counters.requestsSent,
        //     friendsDataReceived   : newCounters.friendsDataReceived    ? newCounters.friendsDataReceived   : counters.friendsDataReceived,
        //     attemptsCountExceeded : newCounters.attemptsCountExceeded  ? newCounters.attemptsCountExceeded : counters.attemptsCountExceeded,
        //     friendsErrorResponse  : newCounters.friendsErrorResponse   ? newCounters.friendsErrorResponse  : counters.friendsErrorResponse,
        //     friendsCount          : newCounters.friendsCount           ? newCounters.friendsCount          : counters.friendsCount
        // });
    // }

    function changeProfile(userName){
        callAPI("users.get", getRequestId(USERS_GET_REQEST_ID), { user_ids: userName, fields: "photo_200, city, nickname"});
    };

    return {
        GetCurrentUserInfo: () => { return bridge.send('VKWebAppGetUserInfo')},
        LoadGroupsData: loadGroupsData,
        ChangeProfile: changeProfile
    }
}

const VKDataService = createVKDataService();

export default VKDataService;
