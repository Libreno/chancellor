import bridge from "@vkontakte/vk-bridge";
import useThrottleCallback from '@react-hook/throttle';

const API_VERSION = "5.110";
const FRIENDS_GET_REQEST_ID = "friends.get";
const GROUPS_GET_REQEST_ID = "groups.get";
// const GROUPS_GET_BY_ID_REQUEST_ID = "groups.getById";

let token = null;

let callAPIMethod = (method, requestId, params) => { 
    let request = {
        "method": method, 
        "request_id": requestId, 
        "params": params
    };
    params["v"] = API_VERSION;
    params["access_token"] = token;
    bridge.send("VKWebAppCallAPIMethod", request);
};

let getGroupsData = (userId = "1") => { 
    let onTokenReceived = ({ detail: { type, data }}) => {
        if (type === "VKWebAppAccessTokenReceived") {
            token = data.access_token;
            // console.log(`token ${token}`);
            bridge.unsubscribe(onTokenReceived);
            callAPIMethod("friends.get", FRIENDS_GET_REQEST_ID, { "userIds": userId });
        }
    };
    bridge.subscribe(onTokenReceived);
    let groupsData = new Map();
    let onFriendsDataReceived = ({ detail: { type, data }}) => {
        if (type === "VKWebAppCallAPIMethodResult" && data.request_id === FRIENDS_GET_REQEST_ID){
            bridge.unsubscribe(onFriendsDataReceived);
            // console.log('flat');
            // console.log(data.response.items.flat());
            let onGroupsDataReceived = ({ detail: { type, data }}) => {
                if (type === "VKWebAppCallAPIMethodResult" && data.request_id.startsWith(GROUPS_GET_REQEST_ID)){
                    let requestedUserId = data.request_id.split(' ')[1];
                    console.log(`requestedUserId ${requestedUserId}`);
                    console.log(data);
                    if (!!data.items){
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
            data.response.items.flat().forEach(userId => {
                callAPIMethod("groups.get", `${GROUPS_GET_REQEST_ID} ${userId}`, { "user_id":  userId, "extended": 1 });
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