import bridge from "@vkontakte/vk-bridge";

const createVKService = () => {
    const APP_ID = 7505513;
    const APP_SCOPE = "friends";
    const API_VERSION = "5.110";
    const FRIENDS_GET_REQEST_ID = "friends.get";
    const GROUPS_GET_REQEST_ID = "groups.get";

    let profileUserId = 0;
    let token = null;
    let onProgress = null;
    let scheduledTime_ms = 0;

    let groupsData = new Map();
    let friendsCount = 0;
    let friendsDataReceived = 0;
    let deletedOrClosedProfiles = [];

    let SKIP_PROFILES_IDS_KEY = '';
    let GROUPS_DATA_KEY = '';

    const LOCAL_STORAGE_PREFIX = "AllFriends"

    const requestInterval_ms = 350;

    const getGroupsData = (setProgress, userId) => { 
        onProgress = setProgress;
        profileUserId = userId;
        SKIP_PROFILES_IDS_KEY = `${profileUserId} deletedOrClosedProfiles`
        GROUPS_DATA_KEY = `${profileUserId} groupsData`;

        let val = getFromCache(GROUPS_DATA_KEY);
        if (!!val){
            return;
        };

        deletedOrClosedProfiles = getFromCache(SKIP_PROFILES_IDS_KEY) ?? deletedOrClosedProfiles;

        bridge.subscribe(listener);
        bridge.send("VKWebAppGetAuthToken", {"app_id": APP_ID, "scope": APP_SCOPE});
    };

    const listener = (obj) => {
        log(obj);
        let { detail: { type, data }} = obj;
        switch (type){
            case ("VKWebAppAccessTokenReceived"):
                onTokenReceived(data);
                break;
            case ("VKWebAppCallAPIMethodResult"):
                if (!getFromCache(data.request_id)){
                    saveToCache(data, data.request_id);
                };
                if (data.request_id.startsWith(FRIENDS_GET_REQEST_ID)){
                    onFriendsDataReceived(data);
                } else if (data.request_id.startsWith(GROUPS_GET_REQEST_ID)){
                    onGroupsDataReceived(data);
                };
                break;
            case ("VKWebAppCallAPIMethodFailed"):
                let params = data.error_data.error_reason.request_params.reduce((o, cv) => {o[cv.key] = cv.value; return o;}, {});
                log(params);
                let errorCode = data.error_data.error_reason.error_code;
                if (errorCode === 6){
                    // In case of error: too many requests per second - reschedule the request
                    log('repeat')
                    callAPI("groups.get", params.request_id, params);
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
        let requestId = getRequestId(FRIENDS_GET_REQEST_ID, profileUserId);
        let dataCached = getFromCache(requestId);
        if (!!dataCached){
            onFriendsDataReceived(dataCached);
        } 
        else {
            callAPI("friends.get", requestId, profileUserId === undefined? {} : { "user_id": profileUserId });
        }
    };

    const onFriendsDataReceived = (data) => {
        let friends = data.response.items;
        friendsCount = friends.length;
        friends.forEach(friendId => {
            if (deletedOrClosedProfiles.indexOf(friendId) !== -1){
                return;
            };
            let requestId = getRequestId(GROUPS_GET_REQEST_ID, friendId, 1);
            let dataCached = getFromCache(requestId);
            if (!!dataCached){
                onGroupsDataReceived(dataCached);
            }
            else {
                callAPI("groups.get", requestId, { "user_id":  friendId, "extended": 1 });
            }
        });
    };

    const handleError = (errorCode, userId) => {
        switch(errorCode){
            case 30:
            case 7:
            case 18:
                log(`private or deleted profile or groups are hidden by user ${userId}`);
                deletedOrClosedProfiles.push(userId);
                break;
            default:
                log('unknown error');
                break;
        }
    }

    const onGroupsDataReceived = (data) => {
        onProgress(++friendsDataReceived * 100 / friendsCount);
        if (!!data.response.items){
            data.response.items.forEach((g) => {
                let key = `${g.name}-${g.id}`;
                let val = groupsData.get(key);
                groupsData.set(key, val === undefined? 1: ++val);
            });
        };
        if (friendsDataReceived === friendsCount){
            bridge.unsubscribe(listener);
            let groupsDataArr = Array.from(groupsData.entries()).sort((a,b)=>{return b[1]-a[1];});
            saveToCache(deletedOrClosedProfiles, SKIP_PROFILES_IDS_KEY);
            saveToCache(groupsDataArr, GROUPS_DATA_KEY);
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
        log(request);

        // first call runs without delay
        if (scheduledTime_ms === 0){
            bridge.send("VKWebAppCallAPIMethod", request);
            scheduledTime_ms = Date.now();
        }
        else{
            // limit 3 requests per second
            scheduledTime_ms = Math.max(scheduledTime_ms + requestInterval_ms, Date.now());
            let timeout = scheduledTime_ms - Date.now();
            setTimeout(() => {
                bridge.send("VKWebAppCallAPIMethod", request);
            }, timeout);
            log(`wait ${timeout} ms`);
        }
    };

    function getRequestId(method, user_id, extended) {
        return `${method} user_id:${user_id} extended:${extended} api_ver:${API_VERSION} appId:${APP_ID} scope:${APP_SCOPE}`;
    }
    
    function getFromCache(request_id) {
        let fullKey = `${LOCAL_STORAGE_PREFIX} ${request_id}`;
        let dataCached = sessionStorage.getItem(fullKey);
        if (!dataCached){
            return;
        };
        log(`Data loaded from sessionStorage with key '${fullKey}'.`)
        let dataParsed = JSON.parse(dataCached);
        log(dataParsed);
        return dataParsed;
    }

    function saveToCache(groupsDataArr, request_id) {
        try {
            let strData = JSON.stringify(groupsDataArr);
            log(`Trying to save string with ${strData.length} chars in sessionStorage.`);
            sessionStorage.setItem(`${LOCAL_STORAGE_PREFIX} ${request_id}`, strData);
            log(`Data saved successfully!`);
        }
        catch (e) {
            log(e);
        };
    };

    return {
        Init: () => {return bridge.send("VKWebAppInit")},
        GetUserInfo: () => { return bridge.send('VKWebAppGetUserInfo')},
        GetGroupsData: getGroupsData,
    }
}

const VKService = createVKService();

export default VKService;
