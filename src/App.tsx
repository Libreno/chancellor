import React, { ReactElement } from 'react'
import View from '@vkontakte/vkui/dist/components/View/View'
import ScreenSpinner from '@vkontakte/vkui/dist/components/ScreenSpinner/ScreenSpinner'
import '@vkontakte/vkui/dist/vkui.css'
import createVKDataService from "./services/VKDataService"
import bridge from "@vkontakte/vk-bridge"
import log from "./logger"

import StartScreen from "./panels/StartScreen"
import DataScreen from './panels/DataScreen'

interface IState{
	activePanel: string,
	vkDataService?: any,
	fetchedUser?: any,
	popOut: ReactElement | null,
	// todo: remove items, use topDataArr instead
	items: Array<any>,
	groupsData: Map<any, any>,
	topDataArr: Array<any>,
	topDataHasMore: boolean,
	counters: any,
	token: string | null,
	timers: Array<any>,
	error?: any
}

const PAGE_SIZE = 10
const COUNTERS_ZERO = { requestsSent:0, requestsQueued:0, friendsCount:0, friendsDataReceived:0, attemptsCountExceeded:0, friendsErrorResponse:0 }
class App extends React.Component<{}, IState>{
	constructor(props: any){
		super(props)

		let vkDataService = createVKDataService()
		this.state = {
			activePanel: 'startScreen',
			// todo: move out vkDataService from state
			vkDataService: vkDataService,
			fetchedUser: null,
			popOut: null,
			items: [],
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
		vkDataService.LoadInitialData().then((res: any) => {
			this.setState({
				token: res[1].access_token,
				fetchedUser: res[0],
				popOut: null
			})
			this.loadData(this.createChlidProps(res[0], res[1].access_token))
		}).catch((err: any) => this.onError(err))
	}

	createChlidProps (user: any, token: string | null) {
		return {
			fetchedUser: user,
			token: token,
			timers: this.state.timers,
			items: this.state.items,
			topDataArr: this.state.topDataArr,
			groupsData: this.state.groupsData,
			setTopDataHasMore: (hasMore: boolean) => {
				this.setState({
					topDataHasMore: hasMore
				})
			},
			incCounter: this.incCounter,
			setItems: (data: any) => {
				this.setState({
					popOut: null,
					items: data
				})
			}
		}
	}

	loadData (props: any) {
		this.state.vkDataService.LoadFriendsGroupsData(props).then((_: any) => {
			const groupsDataArr = Array.from(this.state.groupsData.entries()).sort((a: any, b: any) => { return b[1].friends - a[1].friends }).map((e: any) => { return {value:[e[0], e[1]] }})
			this.setState({
				popOut: null,
				items: groupsDataArr,
				topDataHasMore: false,
			})
		}).catch((err: any) => this.onError(err))
	}

	incCounter (counterName: any, addVal = 1) {
		this.setState((state: any) => {
			let counters = Object.assign({}, state.counters)
			counters[counterName] = (counters[counterName] ?? 0) + addVal
			// log(`rS ${counters.requestsSent}, rQ ${counters.requestsQueued}, fC ${counters.friendsCount}, fDR ${counters.friendsDataReceived}, aCE ${counters.attemptsCountExceeded}, fER ${counters.friendsErrorResponse}`)
			return {
				counters: counters
			}
		})
	}

	onError (errorResponse: any) {
		log(errorResponse)
		this.setState({
			error: (errorResponse?.error_data?.error_reason?.error_msg ?? "Произошла ошибка: " + JSON.stringify(errorResponse))
		})
	}

	incTopCount () {
		const addLength = Math.min(this.state.groupsData.size, this.state.topDataArr.length + PAGE_SIZE) - this.state.topDataArr.length
		let i = 0
		while(i++ < addLength){
			this.state.topDataArr.push(undefined)
		}
		const {data, hasMore} = this.state.vkDataService.GetUpdatedTopData(this.state.groupsData, this.state.topDataArr)
		this.setState({
			items: data,
			topDataHasMore:hasMore
		})
	}

	cleanState () {
		this.state.timers.forEach((t: any) => { t.cancel() })
		this.setState({
			timers: [],
			items: [],
			groupsData: new Map(),
			topDataArr: new Array(PAGE_SIZE),
			topDataHasMore: false,
			counters: COUNTERS_ZERO
		})
	}

	changeUser (user: any) {
		this.setState({
			fetchedUser: user,
			popOut: null,
			vkDataService: createVKDataService()
		})
		this.loadData(this.createChlidProps(user, this.state.token))
	}

	render() { 
		return (
			<View activePanel={this.state.activePanel} popout={this.state.popOut}>
				<StartScreen id='startScreen' go={() => {
					this.setState({
						popOut: <ScreenSpinner/>,
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
				/>
			</View>
		)
	}
}

export default App
