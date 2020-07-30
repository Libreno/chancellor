import React, { useState, useEffect } from 'react'
import View from '@vkontakte/vkui/dist/components/View/View'
import ScreenSpinner from '@vkontakte/vkui/dist/components/ScreenSpinner/ScreenSpinner'
import '@vkontakte/vkui/dist/vkui.css'
import createVKDataService from "./services/VKDataService"
import bridge from "@vkontakte/vk-bridge"
import log from "./logger"

import StartScreen from "./panels/StartScreen"
import DataScreen from './panels/DataScreen'

const App = () => {
	const pageSize = 10
	const countersZero = { requestsSent:0, requestsQueued:0, friendsCount:0, friendsDataReceived:0, attemptsCountExceeded:0, friendsErrorResponse:0, userSawResults:0 }
	const [activePanel, setActivePanel] = useState('startScreen')
	const [vkDataService, setVKDataService] = useState(createVKDataService())
	const [fetchedUser, setUser] : any = useState()
	const [popout, setPopout] : any = useState(null)
	const [items, setItems] : any = useState([])
	const [groupsData, setGroupsData] = useState(new Map())
	const [topDataArr, setTopDataArr] = useState(Array(pageSize))
	const [topDataHasMore, setTopDataHasMore] : any = useState(false)
	const [counters, setCounters] : any[] = useState(countersZero)
	const [token, setToken] = useState(null)
	const [schedule, setSchedule] = useState({ timers: [] })
	const [error, setError] = useState(null)
	
	useEffect(() => {
		bridge.subscribe(({ detail: { type, data }}: any) => {
			if (type === 'VKWebAppUpdateConfig') {
				const schemeAttribute = document.createAttribute('scheme')
				schemeAttribute.value = data.scheme ? data.scheme : 'client_light'
				document.body.attributes.setNamedItem(schemeAttribute)
			}
		})
		vkDataService.LoadInitialData().then((res: any) => {
			setToken(res[1].access_token)
			setUser(res[0])
			setPopout(null)
			loadData(createProps(res[0], res[1].access_token))
		}).catch((err: any) => onError(err))
	}, [])

	const createProps = (user: any, token: string | null) => {
		return {
			fetchedUser: user,
			incCounter: incCounter,
			token: token,
			schedule: schedule,
			groupsData: groupsData,
			topDataArr: topDataArr,
			setItems: (data: any) => {
				setPopout(null)
				setItems(data)
			},
			setTopDataHasMore: setTopDataHasMore
		}
	}

	const loadData = (props: any) => {
		vkDataService.LoadFriendsGroupsData(props).then((_: any) => {
			setPopout(<ScreenSpinner/>)
			const groupsDataArr = Array.from(groupsData.entries()).sort((a: any, b: any) => { return b[1].friends - a[1].friends }).map((e: any) => { return {value:[e[0], e[1]] }})
			setItems(groupsDataArr)
			setTopDataHasMore(false)
			setPopout(null)
		}).catch((err: any) => onError(err))
	}

	const incCounter = (counterName: any, addVal = 1) => {
		counters[counterName] = (counters[counterName] ?? 0) + addVal
		setCounters(counters)
		// log(`rS ${counters.requestsSent}, rQ ${counters.requestsQueued}, fC ${counters.friendsCount}, fDR ${counters.friendsDataReceived}, aCE ${counters.attemptsCountExceeded}, fER ${counters.friendsErrorResponse}`)
	}

	const onError = (errorResponse: any) => {
		log(errorResponse)
		setError(errorResponse?.error_data?.error_reason?.error_msg ?? "Произошла ошибка: " + JSON.stringify(errorResponse))
	}

	const incTopCount = () => {
		const addLength = Math.min(groupsData.size, topDataArr.length + pageSize) - topDataArr.length
		let i = 0
		while(i++ < addLength){
			topDataArr.push(undefined)
		}
		const {data, hasMore} = vkDataService.GetUpdatedTopData(groupsData, topDataArr)
		setItems(data)
		setTopDataHasMore(hasMore)
	}

	const cleanState = () => {
		setPopout(<ScreenSpinner/>)
		schedule.timers.forEach((t: any) => { t.cancel() })
		setSchedule({timers: []})
		setItems([])
		setGroupsData(new Map())
		setTopDataArr(new Array(pageSize))
		setTopDataHasMore(false)
		setCounters({ requestsSent:0, requestsQueued:0, friendsCount:0, friendsDataReceived:0, attemptsCountExceeded:0, friendsErrorResponse:0, userSawResults:0 })
	}

	const changeUser = (user: any) => {
		setUser(user)
		setPopout(null)
		setVKDataService(createVKDataService())
		loadData(createProps(user, token))
	}

	return (
		<View activePanel={activePanel} popout={popout}>
			<StartScreen id='startScreen' go={() => {
				setPopout(<ScreenSpinner/>)
				setActivePanel('dataScreen')
			}}/>
			<DataScreen id='dataScreen'
				token = {token}
				fetchedUser = {fetchedUser} 
				vkDataService = {vkDataService}
				items={items} 
				incTopCount = {incTopCount} 
				hasMore = {topDataHasMore}
				counters = {counters}
				error = {error}
				onError = {onError}
				schedule = {schedule}
				cleanState = {cleanState}
				changeUser = {changeUser}
				setPopout = {setPopout}
				incCounter = {incCounter}
			/>
		</View>
	)
}

export default App
