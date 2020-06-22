import bridge from "@vkontakte/vk-bridge";

const createVKService = () => {
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
    let closedProfiles = [];
    let deletedProfiles = [];

    const LOCAL_STORAGE_PREFIX = "AllFriends_ba0bdfc8-3a48-41d7-ad35-ae6919fcde79"

    const requestInterval_ms = 350;

    const getGroupsData = (setProgress, userId) => { 
        onProgress = setProgress;
        profileUserId = userId;
        let val = localStorage.getItem(getLocalStorageKey());
        if (!!val){
            log('Groups data loaded from local storage');
            log(JSON.parse(val));
            return;
        };

        bridge.subscribe(listener);
        bridge.send("VKWebAppGetAuthToken", {"app_id": 7505513, "scope": "friends"});
    };

    const listener = (obj) => {
        log(obj);
        let { detail: { type, data }} = obj;
        switch (type){
            case ("VKWebAppAccessTokenReceived"):
                onTokenReceived(data);
                break;
            case ("VKWebAppCallAPIMethodResult"):
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
                    callAPI("groups.get", `${params.request_id} repeat`, params);
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
        callAPI("friends.get", FRIENDS_GET_REQEST_ID, profileUserId === undefined? {} : { "user_id": profileUserId });
    };

    const onFriendsDataReceived = (data) => {
        let friends = data.response.items;
        friendsCount = friends.length;
        friends.forEach(friendId => {
            callAPI("groups.get", `${GROUPS_GET_REQEST_ID} ${friendId}`, { "user_id":  friendId, "extended": 1 });
        });
    };

    const handleError = (errorCode, userId) => {
        switch(errorCode){
            case 30:
            case 7:
                log(`private profile or groups are hidden by user ${userId}`);
                closedProfiles.push(userId);
                break;
            case 18:
                log(`deleted profile ${userId}`);
                deletedProfiles.push(userId);
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
            log('onGroupsDataReceived unsubscribed');
            let groupsDataArr = Array.from(groupsData.entries()).sort((a,b)=>{return b[1]-a[1];});
            log(groupsDataArr);
            log('closed profiles');
            log(closedProfiles);
            log('deleted profiles')
            log(deletedProfiles);
            SaveToLocalStorage(groupsDataArr, getLocalStorageKey());
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

    function getLocalStorageKey() {
        return `${LOCAL_STORAGE_PREFIX}_${profileUserId}`;
    }

    function SaveToLocalStorage(groupsDataArr, localStorageKey) {
        try {
            let strData = JSON.stringify(groupsDataArr);
            log(`Trying to save string with ${strData.length} chars in localStorage.`);
            localStorage.setItem(localStorageKey, strData);
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