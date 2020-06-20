import bridge from "@vkontakte/vk-bridge";

const API_VERSION = "5.110";
const FRIENDS_GET_REQEST_ID = "friends.get";
const GROUPS_GET_REQEST_ID = "groups.get";

let token = null;
let friendsCount = 0;
let scheduledTime_ms = 0;

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

const getGroupsData = (progress, userId = "1") => { 
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
    async function onFriendsDataReceived({ detail: { type, data }}) {
        if (type === "VKWebAppCallAPIMethodResult" && data.request_id === FRIENDS_GET_REQEST_ID){
            bridge.unsubscribe(onFriendsDataReceived);
            const onGroupsDataReceived = ({ detail: { type, data }}) => {
                log({ detail: { type, data }});
                if (type === "VKWebAppCallAPIMethodFailed" && data.error_data.error_reason.error_code === 6){
                    // In case of error: too many requests per second - reschedule the request
                    let params = data.error_data.error_reason.request_params.reduce((o, cv) => {o[cv.key] = cv.value; return o;}, {});
                    log('repeat')
                    log(params)
                    callAPI("groups.get", `${params.request_id} repeat`, params);
                }
                else{
                    progress = ++friendsDataReceived * 100 / friendsCount;
                    if (friendsDataReceived === friendsCount){
                        bridge.unsubscribe(onGroupsDataReceived);
                        log('onGroupsDataReceived unsubscribed');
                    }
                };
                if (type === "VKWebAppCallAPIMethodResult" && data.request_id.startsWith(GROUPS_GET_REQEST_ID)){
                    let requestedUserId = data.request_id.split(' ')[1];
                    log(`requestedUserId ${requestedUserId}`);
                    if (!!data.response.items){
                        log(`progress ${progress}`);
                        // let key = `${g.name}-${g.id}`;
                        // let val = groupsData.get(key);
                        // groupsData.set(key, val === undefined? 1: ++val);
                    };
                }
            };
            bridge.subscribe(onGroupsDataReceived);
            let friends = data.response.items.flat();
            friendsCount = friends.length;
            friends.forEach(userId => {
                callAPI("groups.get", `${GROUPS_GET_REQEST_ID} ${userId}`, { "user_id":  userId, "extended": 1 });
            });
        }
    };
    bridge.subscribe(onFriendsDataReceived);
    bridge.send("VKWebAppGetAuthToken", {"app_id": 7505513, "scope": "friends"});
};

const VKService = {
    Init: () => {return bridge.send("VKWebAppInit")},
    GetUserInfo: () => { return bridge.send('VKWebAppGetUserInfo')},
    GetGroupsData: getGroupsData
}

const log = (message) => {
    var today = new Date();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + ":" + today.getMilliseconds();
    console.log(`${time} => ${message}`);
    if (typeof message === 'object'){
        console.log(message);
    }
};

export default VKService;
