import React, { useState, useEffect } from 'react';
import View from '@vkontakte/vkui/dist/components/View/View';
import ScreenSpinner from '@vkontakte/vkui/dist/components/ScreenSpinner/ScreenSpinner';
import '@vkontakte/vkui/dist/vkui.css';
import createVKDataService from "./services/VKDataService"
import bridge from "@vkontakte/vk-bridge";
import log from "./logger"

import StartScreen from "./panels/StartScreen";
import Home from './panels/Home';

const App = () => {
	const pageSize = 10
	const [activePanel, setActivePanel] = useState('startScreen')
	const [vkDataService, setVKDataService] = useState(createVKDataService())
	const [fetchedUser, setUser] : any = useState({})
	const [popout, setPopout] : any = useState(<ScreenSpinner/>)
	const [items, setItems] : any = useState([])
	const [groupsData, setGroupsData] = useState(new Map())
	const [topDataArr, setTopData] : any = useState([])
	const [topDataMaxNum, setTopDataMaxNum] : any = useState(pageSize*2 - 1)
	const [topDataHasMore, setTopDataHasMore] : any = useState(false)
	const [topDataKeys, setTopDataKeys] : any = useState(new Set())
	const [refreshId, refreshView]: any = useState(0)
	const [counters, setCounters] : any[] = useState({ requestsSent:0, requestsQueued:0, friendsCount:0, friendsDataReceived:0, attemptsCountExceeded:0, friendsErrorResponse:0, userSawResults:0 })
	const [token, setToken] = useState(null)
	const [schedule, setSchedule] = useState({ timers: [] })
	const [error, setError] = useState(null)

	const cleanState = () => {
		// todo: clean state
        schedule.timers.forEach((t: any) => {
            t.cancel();
		});
		setSchedule({timers: []});
		setGroupsData(new Map());
	}

	useEffect(() => {
		vkDataService.LoadInitialData().then((res: any) => {
			setToken(res[1].access_token);
			setUser(res[0]);
		}).catch((err) => onError(err));
	}, [vkDataService])

	useEffect(() => {
		let data = 
		// ((counters.friendsDataReceived + counters.attemptsCountExceeded + counters.friendsErrorResponse) / counters.friendsCount >= 0.99)
			// ? ''
			// : 
			vkDataService.GetUpdatedTopData(groupsData, topDataArr, topDataMaxNum, topDataKeys)
		setItems(data)
		setTopDataHasMore(topDataArr.length < groupsData.size)
		log('data.length')
		log(data.length)
	}, [refreshId, groupsData, topDataMaxNum, topDataArr, topDataKeys, vkDataService])

	useEffect(() => {
		log('fetchedUser changed')
		if (!!fetchedUser.id){
			vkDataService.LoadFriendsGroupsData(props);
			setPopout(null);
		}
	}, [fetchedUser, vkDataService])

	const incCounter = (counterName: any, addVal = 1) => {
		counters[counterName] = (counters[counterName] ?? 0) + addVal
		setCounters(counters)
		// log(`rS ${counters.requestsSent}, rQ ${counters.requestsQueued}, fC ${counters.friendsCount}, fDR ${counters.friendsDataReceived}, aCE ${counters.attemptsCountExceeded}, fER ${counters.friendsErrorResponse}`)
	}

	const onError = (errorResponse: any) => {
		setError(errorResponse.error_data.error_reason.error_msg)
	}

	const props = {
		fetchedUser: fetchedUser,
		incCounter: incCounter,
		groupsData: groupsData,
		schedule: schedule,
		token: token,
		onError: onError,
		refreshView: refreshView
	}

	useEffect(() => {
		bridge.subscribe(({ detail: { type, data }}: any) => {
			if (type === 'VKWebAppUpdateConfig') {
				const schemeAttribute = document.createAttribute('scheme');
				schemeAttribute.value = data.scheme ? data.scheme : 'client_light';
				document.body.attributes.setNamedItem(schemeAttribute);
			}
		});
	}, [])

	return (
		// <div><div>friendsCount: {counters.friendsCount}</div>
		// <div>friendsDataReceived: {counters.friendsDataReceived}</div>
		// <div>requestsSent: {counters.requestsSent}</div>
		// <div>timers.length: {schedule.timers.length}</div>
		// </div>
		<View activePanel={activePanel} popout={popout}>
			<StartScreen id='startScreen' go={() => setActivePanel('home')}/>
			<Home id='home' 
				fetchedUser = {fetchedUser} 
				vkDataService = {vkDataService}
				items={items} 
				incTopCount = {() => {
					log('incTopCount ' + (Number(topDataMaxNum) + Number(pageSize)));
					setTopDataMaxNum(Number(topDataMaxNum) + Number(pageSize))
				}} 
				hasMore = {topDataHasMore}
				counters = {counters}
				error = {error}/>
		</View>
	)
}

export default App
