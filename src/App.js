import React, { useState, useEffect } from 'react';
import View from '@vkontakte/vkui/dist/components/View/View';
import ScreenSpinner from '@vkontakte/vkui/dist/components/ScreenSpinner/ScreenSpinner';
import '@vkontakte/vkui/dist/vkui.css';
import VKDataService from "./services/VKDataService"
import bridge from "@vkontakte/vk-bridge";

import StartScreen from "./panels/StartScreen";
import Home from './panels/Home';

const App = () => {
	const [activePanel, setActivePanel] = useState('home');
	const [fetchedUser, setUser] = useState(null);
	const [popout, setPopout] = useState(<ScreenSpinner size='large' />);
	const [items, setItems] = useState([]);
	const pageSize = 10;
	// const [topCount, setTopCount] = useState(pageSize);
	// const [topHasMore, setHasMore] = useState(false);
	const [groupsData, setGroupsData] = useState(new Map());
	const [friendsRequestsData, setFriendsRequestsData] = useState(new Map());
	// const [topDataKeysSet, setTopDataKeysSet] = useState(new Set());
	// const [topDataArr, setTopDataArr] = useState([]);
	const [topData, setTopData] = useState({count:pageSize, arr: [], keys: new Set(), hasMore: false})
	const [counters, setCounters] = useState({ requestsSent:0, requestsQueued:0, friendsCount:0, friendsDataReceived:0, attemptsCountExceeded:0, friendsErrorResponse:0, userSawResults:0 });
	const [token, setToken] = useState(null);
	const [schedule, setSchedule] = useState({timers: [], scheduledTime_ms: 0});
	const [error, setError] = useState(null);

	const readyToFinish = () => {
		return counters.userSawResults === 0
			&& counters.friendsCount > 0 
			&& ((counters.friendsDataReceived + counters.attemptsCountExceeded + counters.friendsErrorResponse) === counters.friendsCount) 
			&& counters.requestsSent === counters.requestsQueued;
	}

	const incCounter = (counterName, addVal) => {
		let c = {};
		c[counterName] = counters[counterName] ?? 0 + addVal;
		// Object.assign({}, counters, c);
		setCounters(c);
		log(`rS ${counters.requestsSent}, rQ ${counters.requestsQueued}, fC ${counters.friendsCount}, fDR ${counters.friendsDataReceived}, aCE ${counters.attemptsCountExceeded}, fER ${counters.friendsErrorResponse}`);
	}

	const onUserSearchFailed = (errorResponse) => {
		setError(errorResponse.error_data.error_reason.error_msg);
	};

	const cleanState = () => {
		// todo: clean state
		setGroupsData(new Map());
	}

	const start = () => {
		VKDataService.GetGroupsData({
			fetchedUser: fetchedUser,
			setItems: setItems,
			incCounter: incCounter,
			topData: topData,
			setTopData: setTopData,
			groupsData: groupsData,
			friendsRequestsData: friendsRequestsData,
			readyToFinish: readyToFinish,
			schedule: schedule,
			token: token,
			setToken: setToken,
			onUserSearchFailed: onUserSearchFailed,
			setUser: setUser,
			cleanState: cleanState,
			log: log
		});
	};

	const clearTimeouts = () => {
        schedule.topData.timers.forEach((t) => {
            clearTimeout(t);
		});
		setSchedule({timers: []});
	};

	useEffect(() => {
		bridge.subscribe(({ detail: { type, data }}) => {
			if (type === 'VKWebAppUpdateConfig') {
				const schemeAttribute = document.createAttribute('scheme');
				schemeAttribute.value = data.scheme ? data.scheme : 'client_light';
				document.body.attributes.setNamedItem(schemeAttribute);
			}
		});
		VKDataService.GetCurrentUserInfo().then((user) => {
			setUser(user);
			start();
			setPopout(null);
		});
	}, [fetchedUser, items, groupsData, friendsRequestsData, topData, counters, token, schedule, error]);

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

	return (
		<View activePanel={activePanel} popout={popout}>
			<StartScreen id='startScreen' go={setActivePanel('home')}/>
			<Home id='home' 
				fetchedUser={fetchedUser} 
				items={items} 
				incTopCount = {() => {
					console.log('incTopCount ' + (Number(topData.count) + Number(pageSize)));
					setTopData({ count: Number(topData.count) + Number(pageSize) })
				}} 
				hasMore = {topData.hasMore}
				counters = {counters}
				error = {error}/>
		</View>
	);
}

export default App;
