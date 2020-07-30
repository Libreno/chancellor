import React, {useState} from 'react'
import Panel from '@vkontakte/vkui/dist/components/Panel/Panel'
import Alert from '@vkontakte/vkui/dist/components/Alert/Alert'
import PanelHeader from '@vkontakte/vkui/dist/components/PanelHeader/PanelHeader'
import Progress from "@vkontakte/vkui/dist/components/Progress/Progress"
import Button from '@vkontakte/vkui/dist/components/Button/Button'
import Group from '@vkontakte/vkui/dist/components/Group/Group'
import Cell from '@vkontakte/vkui/dist/components/Cell/Cell'
import Input from '@vkontakte/vkui/dist/components/Input/Input'
import FormLayout from '@vkontakte/vkui/dist/components/FormLayout/FormLayout'
import FormStatus from '@vkontakte/vkui/dist/components/FormStatus/FormStatus'
import Avatar from '@vkontakte/vkui/dist/components/Avatar/Avatar'
import { List } from '@vkontakte/vkui'
import InfiniteScroll from 'react-infinite-scroll-component'
import log from '../logger'
import '../styles/style.css'
import { API_REQUEST_INTERVAL } from "../services/VKDataService"

const DataScreen = ({ id, parentState, incTopCount, onError, cleanState, changeUser, setPopOut, setParentState, incCounter }: any) => {
	const [userLink, setUserLink] = useState('')
	const [showAll, setShowAll] = useState(false)

	const loadUserClick = () => {
		setParentState({
			error: null
		})
		if (userLink === ""){
			return
		}
		let segments = userLink.split('/')
		let userName = segments[segments.length - 1]
		log(userName)
		cleanState()
		parentState.vkDataService.GetUser(parentState.token, parentState.timers, incCounter, userName).then((userResponse: any) => {
			// todo check if new user is not equal to previously fetched
			// setUserLink()
			// setPopOut(
			// 	<Alert
			// 		actions={[{
			// 			title: 'Отмена',
			// 			autoclose: true,
			// 			mode: 'cancel'
			// 		}, {
			// 			title: 'Загрузить нового пользователя',
			// 			autoclose: true,
			// 			action: () => {
			// 				cleanState()
			// 				changeUser(userResponse)
			// 			},
			// 			mode: 'default'
			// 		}]}
			// 		onClose={() => {setPopOut(null)}}
			// 	>
			// 		<h2>Подтвердите действие</h2>
			// 		<p>Смена пользователя приведёт к потере собранных данных текущего пользователя. Вы уверены?</p>
			// 	</Alert>
			// )
			changeUser(userResponse.response[0])
		}).catch((e: any) => { 
			onError(e) 
		})
	}

	const clickMore = () =>{
		setShowAll(true)
		incTopCount()
	}

	const buttonMoreStyle = {
		display:showAll||!parentState.topDataHasMore? 'none': 'block'
	}

	const progressStyle = {
		display: parentState.counters.friendsDataReceived + parentState.counters.attemptsCountExceeded + parentState.counters.friendsErrorResponse === parentState.counters.friendsCount? 'none' : 'block'
	}
	
	return (
		<Panel id={id}>
			<PanelHeader>Мои друзья и их сообщества</PanelHeader>
			<FormLayout>
				<FormStatus hidden={!parentState.error} header="Ошибка" mode="error">{parentState.error}</FormStatus>
				<Input type = "text" onChange={(e) => {setUserLink(e.target.value)}}/>
				<Button stretched size = "xl" onClick={loadUserClick}>Загрузить</Button>
				{parentState.fetchedUser &&
				<Group>
					<Cell
						before={parentState.fetchedUser.photo_200 ? <Avatar src={parentState.fetchedUser.photo_200}/> : null}
						description={parentState.fetchedUser.city && parentState.fetchedUser.city.title ? parentState.fetchedUser.city.title : ''}>
						{`${parentState.fetchedUser.first_name} ${parentState.fetchedUser.last_name}`}
					</Cell>
				</Group>}
			</FormLayout>
			<div id='allfriends-progressbar'>
				<div>
					Загружено {parentState.counters.friendsDataReceived + parentState.counters.attemptsCountExceeded + parentState.counters.friendsErrorResponse} из {parentState.counters.friendsCount} друзей. 
				</div>
				<div style={progressStyle}>
					Осталось ~ {Math.round(parentState.timers.length * API_REQUEST_INTERVAL / 60000)} мин.
				</div>
			</div>
			<Progress value={(parentState.counters.friendsDataReceived + parentState.counters.attemptsCountExceeded + parentState.counters.friendsErrorResponse) * 100 / parentState.counters.friendsCount} />

			<Group id='allfriends-groups-list'>
				<List>
					<InfiniteScroll
						dataLength={parentState.items.length}
						next={incTopCount}
						hasMore={parentState.topDataHasMore}
						loader={<h4>Loading...</h4>}
						>
						{parentState.items.map((item: any, i: number) => {
							return <div className='allfriends-vk-group-card' key={i}>
										<div className='group-name'>[{item.value[1].friends}]&nbsp;{item.value[1].name}</div>
										<div className='group-id'>{item.value[0]}</div>
									</div>
						})}
					</InfiniteScroll>
				</List>
				<Button style={buttonMoreStyle} className="more-button" stretched size = "xl" onClick={clickMore}>Показать все</Button>
			</Group>
		</Panel>
		)
}

export default DataScreen
