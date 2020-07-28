import React, { useState, useEffect } from 'react';
import View from '@vkontakte/vkui/dist/components/View/View';
import ScreenSpinner from '@vkontakte/vkui/dist/components/ScreenSpinner/ScreenSpinner';
import '@vkontakte/vkui/dist/vkui.css';
import createVKDataService from "./services/VKDataService"
import bridge from "@vkontakte/vk-bridge";
import log from "./logger"

import StartScreen from "./panels/StartScreen";
import DataScreen from './panels/DataScreen';

const App = () => {
	const pageSize = 10
	const [activePanel, setActivePanel] = useState('startScreen')
	const [vkDataService, setVKDataService] = useState(createVKDataService())
	const [fetchedUser, setUser] : any = useState()
	const [popout, setPopout] : any = useState(null)
	const [items, setItems] : any = useState([])
	const [groupsData] = useState(new Map())
	const [topDataArr] = useState(Array(pageSize))
	const [topDataHasMore, setTopDataHasMore] : any = useState(false)
	const [counters, setCounters] : any[] = useState({ requestsSent:0, requestsQueued:0, friendsCount:0, friendsDataReceived:0, attemptsCountExceeded:0, friendsErrorResponse:0, userSawResults:0 })
	const [token, setToken] = useState(null)
	const [schedule, setSchedule] = useState({ timers: [] })
	const [error, setError] = useState(null)

	const cleanState = () => {
		// todo: clean state
        schedule.timers.forEach((t: any) => {
            t.cancel()
		})
		setSchedule({timers: []})
	}

	useEffect(() => {
		vkDataService.LoadInitialData().then((res: any) => {
			setToken(res[1].access_token)
			setUser(res[0])
			setPopout(null)
		}).catch((err: any) => onError(err))
	}, [vkDataService])

	useEffect(() => {
		if (!!fetchedUser){
			vkDataService.LoadFriendsGroupsData(props).then((_: any) => {
				setPopout(<ScreenSpinner/>)
				const groupsDataArr = Array.from(groupsData.entries()).sort((a: any, b: any) => { return b[1].friends - a[1].friends; }).map((e: any) => { return {value:[e[0], e[1]] }});
				setItems(groupsDataArr)
				setTopDataHasMore(false)
				setPopout(null)
			}).catch((err: any) => onError(err))
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
		topDataArr: topDataArr,
		setItems: setItems,
		setTopDataHasMore: setTopDataHasMore,
		schedule: schedule,
		token: token,
		onError: onError,
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
		<View activePanel={activePanel} popout={popout}>
			<StartScreen id='startScreen' go={() => {if (!fetchedUser){ setPopout(<ScreenSpinner/>) }; setActivePanel('dataScreen')}}/>
			<DataScreen id='dataScreen'
				fetchedUser = {fetchedUser} 
				vkDataService = {vkDataService}
				items={items} 
				incTopCount = {() => {
					const addLength = Math.min(groupsData.size, topDataArr.length + pageSize) - topDataArr.length
					let i = 0
					while(i++ < addLength){
						topDataArr.push(undefined)
					}
					const {data, hasMore} = vkDataService.GetUpdatedTopData(groupsData, topDataArr)
					setItems(data)
					setTopDataHasMore(hasMore)
				}} 
				hasMore = {topDataHasMore}
				counters = {counters}
				error = {error}/>
		</View>
	)
}

export default App
