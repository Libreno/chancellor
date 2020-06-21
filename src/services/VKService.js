import bridge from "@vkontakte/vk-bridge";

const API_VERSION = "5.110";
const FRIENDS_GET_REQEST_ID = "friends.get";
const GROUPS_GET_REQEST_ID = "groups.get";

let token = null;
let friendsCount = 0;
let scheduledTime_ms = 0;

const LOCAL_STORAGE_PREFIX = "AllFriends_ba0bdfc8-3a48-41d7-ad35-ae6919fcde79"

const requestInterval_ms = 350;

const callAPI = (method, requestId, params) => { 
    let request = {
        "method": method, 
        "request_id": requestId, 
        "params": params
    };
    params["v"] = API_VERSION;
    params["access_token"] = token;

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

const getGroupsData = (onProgress, userId = "1") => { 
    let localStorageKey = `${LOCAL_STORAGE_PREFIX}_${userId}`;
    let val = localStorage.getItem(localStorageKey);
    if (!!val){
        log('Groups data loaded from local storage');
        log(JSON.parse(val));
        return;
    };
    const onTokenReceived = ({ detail: { type, data }}) => {
        if (type === "VKWebAppAccessTokenReceived") {
            token = data.access_token;
            bridge.unsubscribe(onTokenReceived);
            callAPI("friends.get", FRIENDS_GET_REQEST_ID, { "userIds": userId });
        }
    };
    bridge.subscribe(onTokenReceived);
    let groupsData = new Map();
    let friendsDataReceived = 0;
    let closedProfiles = [];
    let deletedProfiles = [];
    async function onFriendsDataReceived({ detail: { type, data }}) {
        log('friends data:');
        log(data);
        if (type === "VKWebAppCallAPIMethodResult" && data.request_id === FRIENDS_GET_REQEST_ID){
            bridge.unsubscribe(onFriendsDataReceived);
            const onGroupsDataReceived = ({ detail: { type, data }}) => {
                let errorCode = 0;
                log({ detail: { type, data }});
                if (type === "VKWebAppCallAPIMethodFailed"){
                    let params = data.error_data.error_reason.request_params.reduce((o, cv) => {o[cv.key] = cv.value; return o;}, {});
                    errorCode = data.error_data.error_reason.error_code;
                    switch(errorCode){
                        case 6:
                            // In case of error: too many requests per second - reschedule the request
                            log('repeat')
                            log(params)
                            callAPI("groups.get", `${params.request_id} repeat`, params);
                            break;
                        case 7:
                            log(`closed profile ${params.user_id}`);
                            closedProfiles.push(params.user_id);
                            break;
                        case 18:
                            log(`deleted profile ${params.user_id}`);
                            deletedProfiles.push(params.user_id);
                            break;
                        default:
                            log('unknown error');
                            break;
                    }
                };
                if (errorCode !== 6){
                    onProgress(++friendsDataReceived * 100 / friendsCount);
                }
                if (type === "VKWebAppCallAPIMethodResult" && data.request_id.startsWith(GROUPS_GET_REQEST_ID)){
                    let requestedUserId = data.request_id.split(' ')[1];
                    log(`requestedUserId ${requestedUserId}`);
                    if (!!data.response.items){
                        data.response.items.forEach((g) => {
                            let key = `${g.name}-${g.id}`;
                            let val = groupsData.get(key);
                            groupsData.set(key, val === undefined? 1: ++val);
                        });
                    };
                }
                if (friendsDataReceived === friendsCount){
                    bridge.unsubscribe(onGroupsDataReceived);
                    log('onGroupsDataReceived unsubscribed');
                    let groupsDataArr = Array.from(groupsData.entries()).sort((a,b)=>{return b[1]-a[1];});
                    localStorage.setItem(localStorageKey, JSON.stringify(groupsDataArr));
                    log(groupsDataArr);
                    log('closed profiles');
                    log(closedProfiles);
                    log('deleted profiles')
                    log(deletedProfiles);
                };
            };
            bridge.subscribe(onGroupsDataReceived);
            let friends = data.response.items;
            friendsCount = friends.length;
            friends.forEach(userId => {
                callAPI("groups.get", `${GROUPS_GET_REQEST_ID} ${userId}`, { "user_id":  userId, "extended": 1 });
            });
        }
    };
    bridge.subscribe(onFriendsDataReceived);
    bridge.send("VKWebAppGetAuthToken", {"app_id": 7505513, "scope": "friends"});
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

const VKService = {
    Init: () => {return bridge.send("VKWebAppInit")},
    GetUserInfo: () => { return bridge.send('VKWebAppGetUserInfo')},
    GetGroupsData: getGroupsData
}

export default VKService;
