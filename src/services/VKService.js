import bridge from "@vkontakte/vk-bridge";

const API_VERSION = "5.110";
const FRIENDS_GET_REQEST_ID = "friends.get";
const GROUPS_GET_REQEST_ID = "groups.get";
// const GROUPS_GET_BY_ID_REQUEST_ID = "groups.getById";

let token = null;
let friendsCount = 0;
let scheduledTime_ms = 0;

const requestInterval_ms = 334;

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
        console.log(`wait ${timeout} ms`);
    }
};

const getGroupsData = (progress, userId = "1") => { 
    const onTokenReceived = ({ detail: { type, data }}) => {
        if (type === "VKWebAppAccessTokenReceived") {
            token = data.access_token;
            // console.log(`token ${token}`);
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
            // console.log('flat');
            // console.log(data.response.items.flat());
            const onGroupsDataReceived = ({ detail: { type, data }}) => {
                console.log({ detail: { type, data }});
                if (type === "VKWebAppCallAPIMethodFailed" && data.error_data.error_reason.error_code === 6){
                    // In case of error: too many requests per second - reschedule the request
                    let params = data.error_data.error_reason.request_params;
                    callAPI("groups.get", params.find(p => p.key === "request_id").value, params);
                }
                else{
                    progress = ++friendsDataReceived * 100 / friendsCount;
                };
                if (type === "VKWebAppCallAPIMethodResult" && data.request_id.startsWith(GROUPS_GET_REQEST_ID)){
                    let requestedUserId = data.request_id.split(' ')[1];
                    console.log(`requestedUserId ${requestedUserId}`);
                    if (!!data.response.items){
                        // progress = ++friendsDataReceived * 100 / friendsCount;
                        console.log(`progress ${progress}`);
                        // let key = `${g.name}-${g.id}`;
                        // let val = groupsData.get(key);
                        // groupsData.set(key, val === undefined? 1: ++val);
                        // console.log(`No groups for user ${requestedUserId}`);
                        // let ids = [];
                        // data.items.forEach(groupId => {
                        //     ids.push(groupId);
                        //     if (ids.count === 500){
                        //         callAPIMethod("groups.getById", GROUPS_GET_BY_ID_REQUEST_ID, { "group_ids": ids.join(',') });
                        //         ids = [];
                        //     }
                        // });
                        // if (ids.count > 0){
                        //     // callAPIMethod("groups.getById", GROUPS_GET_BY_ID_REQUEST_ID,)
                        // }
                    };
                    // data.items.forEach(g => {
                    //     let key = `${g.name}-${g.id}`;
                    //     let val = groupsData.get(key);
                    //     groupsData.set(key, val === undefined? 1: ++val);
                    // })
                }
            };
            bridge.subscribe(onGroupsDataReceived);
            // todo: unsubscribe from onUsersDataReceived after all users data received
            // console.log(data.response);
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

export default VKService;
