import React, {useState} from 'react';
import Panel from '@vkontakte/vkui/dist/components/Panel/Panel';
import PanelHeader from '@vkontakte/vkui/dist/components/PanelHeader/PanelHeader';
import Progress from "@vkontakte/vkui/dist/components/Progress/Progress";
import Button from '@vkontakte/vkui/dist/components/Button/Button';
import Group from '@vkontakte/vkui/dist/components/Group/Group';
import Cell from '@vkontakte/vkui/dist/components/Cell/Cell';
import Input from '@vkontakte/vkui/dist/components/Input/Input';
import FormLayout from '@vkontakte/vkui/dist/components/FormLayout/FormLayout';
import FormStatus from '@vkontakte/vkui/dist/components/FormStatus/FormStatus';
import Avatar from '@vkontakte/vkui/dist/components/Avatar/Avatar';
import { List } from '@vkontakte/vkui';
import InfiniteScroll from 'react-infinite-scroll-component';
import log from '../logger'
import '../styles/style.css'
import { API_GROUPS_GET_REQUEST_INTERVAL } from "../services/VKDataService"

// rename to GroupsDataComponent
const DataScreen = ({ id, fetchedUser, vkDataService, counters, items, incTopCount, hasMore, error, schedule }: any) => {
	const loadUserClick = () => {
		if (userLink === ""){
			return
		};
		let segments = userLink.split('/')
		let userName = segments[segments.length - 1]
		vkDataService.ChangeProfile(userName)
	};

	const [userLink, setUserLink] = useState('')
	const [showAll, setShowAll] = useState(false)

	const buttonMoreStyle = {
		display:showAll||!hasMore? 'none': 'block'
	}

	const progressStyle = {
		display: counters.friendsDataReceived + counters.attemptsCountExceeded + counters.friendsErrorResponse === counters.friendsCount? 'none' : 'block'
	}

	// log('DataScreen items.length ' + items.length)
	// log('DataScreen hasMore ' + hasMore)

	return (
		<Panel id={id}>
			<PanelHeader>Мои друзья и их сообщества</PanelHeader>
			<FormLayout>
				<FormStatus hidden={!error} header="Ошибка" mode="error">{error}</FormStatus>
				<Input type = "text" onChange={(e) => {setUserLink(e.target.value);}}/>
				<Button stretched size = "xl" onClick={loadUserClick}>Загрузить</Button>
				{fetchedUser &&
				<Group>
					<Cell
						before={fetchedUser.photo_200 ? <Avatar src={fetchedUser.photo_200}/> : null}
						description={fetchedUser.city && fetchedUser.city.title ? fetchedUser.city.title : ''}>
						{`${fetchedUser.first_name} ${fetchedUser.last_name}`}
					</Cell>
				</Group>}
			</FormLayout>

			<table id='allfriends-progressbar'><tbody><tr>
				<td>
					Загружено {counters.friendsDataReceived + counters.attemptsCountExceeded + counters.friendsErrorResponse} из {counters.friendsCount}. 
				</td>
				<td style={progressStyle}>
					Осталось ~ {Math.round(schedule.timers.length * API_GROUPS_GET_REQUEST_INTERVAL / 60000)} мин.
				</td></tr></tbody>
			</table>
			<Progress value={(counters.friendsDataReceived + counters.attemptsCountExceeded + counters.friendsErrorResponse) * 100 / counters.friendsCount} />

			<Group id='allfriends-groups-list'>
				<List>
					<InfiniteScroll
						dataLength={items.length}
						next={incTopCount}
						hasMore={hasMore}
						loader={<h4>Loading...</h4>}
						>
						{items.map((item: any, i: number) => {
							return <div className='allfriends-vk-group-card' key={i}>
										<div className='group-name'>[{item.value[1].friends}]&nbsp;{item.value[1].name}</div>
										<div className='group-id'>{item.value[0]}</div>
									</div>
						})}
					</InfiniteScroll>
				</List>
				<Button style={buttonMoreStyle} className="more-button" stretched size = "xl" onClick={() =>{ setShowAll(true); incTopCount()}}>Показать все</Button>
			</Group>
		</Panel>
		)
}

export default DataScreen;
