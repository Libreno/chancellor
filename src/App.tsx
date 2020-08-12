// Copyright © 2020, Farkhad Muminov. All rights reserved.
import React, { ReactElement } from 'react'
import View from '@vkontakte/vkui/dist/components/View/View'
import ScreenSpinner from '@vkontakte/vkui/dist/components/ScreenSpinner/ScreenSpinner'
import '@vkontakte/vkui/dist/vkui.css'
import bridge from "@vkontakte/vk-bridge"
import log from "./logger"

import StartScreen from "./panels/StartScreen"
import DataScreen from './panels/DataScreen'
import VKDataService, { IVKDataService } from './services/VKDataService'

interface IState{
	activePanel: string,
	vkDataService: IVKDataService,
	fetchedUser?: any,
	popOut: ReactElement | null,
	groupsData: Map<any, any>,
	topDataArr: Array<any>,
	topDataHasMore: boolean,
	counters: any,
	token: string | null,
	timers: Array<any>,
	error?: any
}

const PAGE_SIZE = 10
const COUNTERS_ZERO = { requestsSent:0, requestsQueued:0, friendsCount:0, friendsDataReceived:0, attemptsCountExceeded:0, friendsErrorResponse:0, friendsProfileClosed:0, groupsCount:0 }
class App extends React.Component<{}, IState>{
	constructor(props: any){
		super(props)

		let vkDataService = new VKDataService()
		this.state = {
			activePanel: 'startScreen',
			vkDataService: vkDataService,
			fetchedUser: null,
			popOut: null,
			groupsData: new Map(),
			topDataArr: new Array(PAGE_SIZE),
			topDataHasMore: false,
			counters: COUNTERS_ZERO,
			token: null,
			timers: [],
			error: null
		}
		this.incCounter = this.incCounter.bind(this)
		this.createChlidProps = this.createChlidProps.bind(this)
		this.loadData = this.loadData.bind(this)
		this.incCounter = this.incCounter.bind(this)
		this.setCounter = this.setCounter.bind(this)
		this.changeCounter = this.changeCounter.bind(this)
		this.onError = this.onError.bind(this)
		this.incTopCount = this.incTopCount.bind(this)
		this.cleanState = this.cleanState.bind(this)
		this.changeUser = this.changeUser.bind(this)

		bridge.subscribe(({ detail: { type, data }}: any) => {
			if (type === 'VKWebAppUpdateConfig') {
				const schemeAttribute = document.createAttribute('scheme')
				schemeAttribute.value = data.scheme ? data.scheme : 'client_light'
				document.body.attributes.setNamedItem(schemeAttribute)
			}
		})
		vkDataService.loadInitialData().then((res: any) => {
			this.setState({
				token: res[1].access_token,
				fetchedUser: res[0],
			})
			this.loadData(this.createChlidProps(res[0], res[1].access_token))
		}).catch((err: any) => this.onError(err))
	}

	createChlidProps (user: any, token: string | null) {
		return {
			fetchedUser: user,
			token: token,
			timers: this.state.timers,
			topDataArr: this.state.topDataArr,
			groupsData: this.state.groupsData,
			setTopDataHasMore: (hasMore: boolean) => {
				this.setState({
					topDataHasMore: hasMore
				})
			},
			incCounter: this.incCounter,
			setCounter: this.setCounter,
			onError: this.onError
		}
	}

	async loadData(props: any) {
		try{
			const friendsDataArr = await this.state.vkDataService.getFriends(props);//.then((friendsDataArr: any) => {
			this.setState({
				popOut: null
			});
			friendsDataArr.forEach(async (friendsRespPromise: Promise<any>) => {
				const friendsResp = await friendsRespPromise;
				friendsResp.response.items.forEach(async (friendId: number) => {
					await this.state.vkDataService.handleFriend(props, friendId)
				});
			})
		}
		catch(err){
			this.onError(err)
		}
	}

	changeCounter (counterName: any, addVal = 1, valueFunc: any) {
		this.setState((state: any) => {
			const counters = Object.assign({}, state.counters)
			counters[counterName] = valueFunc((counters[counterName] ?? 0), addVal)
			// log(`rS ${counters.requestsSent}, rQ ${counters.requestsQueued}, fC ${counters.friendsCount}, fDR ${counters.friendsDataReceived}, aCE ${counters.attemptsCountExceeded}, fER ${counters.friendsErrorResponse}`)
			return {
				counters: counters
			}
		})
	}

	incCounter (counterName: any, addVal = 1) {
		this.changeCounter(counterName, addVal, 
			(currentValue: any, passedValue: any) => currentValue + passedValue)
	}

	setCounter (counterName: any, newVal: number) {
		this.changeCounter(counterName, newVal,
			(_: any, passedValue: any) => passedValue)
	}

	onError (errorResponse: any) {
		log(errorResponse)
		this.setState({
			error: (errorResponse?.error_data?.error_reason?.error_msg ?? "Произошла ошибка: " + JSON.stringify(errorResponse)),
			popOut: null
		})
	}

	incTopCount () {
		const addLength = Math.min(this.state.groupsData.size, this.state.topDataArr.length + PAGE_SIZE) - this.state.topDataArr.length
		let i = 0
		while(i++ < addLength){
			this.state.topDataArr.push(undefined)
		}
		const hasMore = this.state.vkDataService.updateTopData_(this.state.groupsData, this.state.topDataArr)
		this.setState({
			topDataHasMore:hasMore
		})
	}

	cleanState () {
		this.state.timers.forEach((t: any) => { t.cancel() })
		this.setState({
			timers: [],
			groupsData: new Map(),
			topDataArr: new Array(PAGE_SIZE),
			topDataHasMore: false,
			counters: COUNTERS_ZERO
		})
	}

	changeUser (user: any) {
		this.setState({
			fetchedUser: user,
			popOut: <ScreenSpinner/>,
			vkDataService: new VKDataService()
		})
		this.loadData(this.createChlidProps(user, this.state.token))
	}

	render() { 
		return (
			<View activePanel={this.state.activePanel} popout={this.state.popOut}>
				<StartScreen id='startScreen' go={() => {
					this.setState({
						popOut: this.state.counters.friendsCount === 0? <ScreenSpinner/> : null,
						activePanel: 'dataScreen'
					})
				}}/>
				<DataScreen id='dataScreen'
					parentState = {this.state}
					incTopCount = {this.incTopCount} 
					onError = {this.onError}
					cleanState = {this.cleanState}
					changeUser = {this.changeUser}
					setParentState = {(s: any) => {
						this.setState(s)
					}}
					incCounter = {this.incCounter}
					setPopOut = {(popOut: any) => {
						this.setState({
							popOut: popOut
						})
					}}
				/>
			</View>
		)
	}
}

export default App
