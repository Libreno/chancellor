import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import Panel from '@vkontakte/vkui/dist/components/Panel/Panel';
import PanelHeader from '@vkontakte/vkui/dist/components/PanelHeader/PanelHeader';
import Progress from "@vkontakte/vkui/dist/components/Progress/Progress";
import Button from '@vkontakte/vkui/dist/components/Button/Button';
import Group from '@vkontakte/vkui/dist/components/Group/Group';
import Cell from '@vkontakte/vkui/dist/components/Cell/Cell';
import Input from '@vkontakte/vkui/dist/components/Input/Input';
import FormLayout from '@vkontakte/vkui/dist/components/FormLayout/FormLayout';
import FormStatus from '@vkontakte/vkui/dist/components/FormStatus/FormStatus';
import Div from '@vkontakte/vkui/dist/components/Div/Div';
import Avatar from '@vkontakte/vkui/dist/components/Avatar/Avatar';
import { List } from '@vkontakte/vkui';
import bridge from "@vkontakte/vk-bridge";
import VKDataService from "../services/VKDataService";

const Home = ({ id, go, fetchedUser, progress, items, setUser }) => {
	const IS_MVK = window.location.href.indexOf('vk_platform=mobile_web') !== -1;
	const getUserInfo = () => {
		// todo: validation
		// console.log('userlink = ' + userLink);
		if (userLink === ""){
			return;
		};
		let segments = userLink.split('/');
		let userName = segments[segments.length - 1];
		// console.log('userName = ' + userName);
		VKDataService.GetUserInfo(userName).then((userData) => {
			// console.log('userData');
			setUser(userData.response[0]);
		}).catch((errorResponse) => {
			// console.log('errorData');
			setError(errorResponse.error_data.error_reason.error_msg);
		});
	};

	const [error, setError] = useState(null);
	const [userLink, setUserLink] = useState('');
	
	if (IS_MVK){
		return (
			<Panel id={id}>
				<PanelHeader>Группы друзей</PanelHeader>
				<FormLayout>
					<FormStatus hidden={!error} header="Ошибка" mode="error">{error}</FormStatus>
					<Input type = "text" onChange={(e) => {setUserLink(e.target.value);}}/>
					<Button stretched size = "xl" onClick={getUserInfo}>Загрузить</Button>
					{fetchedUser &&
					<Group>
						<Cell style={{marginLeft:12}}
							before={fetchedUser.photo_200 ? <Avatar src={fetchedUser.photo_200}/> : null}
							description={fetchedUser.city && fetchedUser.city.title ? fetchedUser.city.title : ''}>
							{`${fetchedUser.first_name} ${fetchedUser.last_name}`}
						</Cell>
					</Group>}
				</FormLayout>

				<Progress value={progress} />

				<Group>
					<List>
						{items.map((item) => <Cell key={item.value[0]}>[{item.value[1].friends}] {item.value[1].name} </Cell>)}
					</List>
				</Group>
			</Panel>)
	} else {
		return (
			<Panel id={id}>
				<FormLayout>
					<FormStatus hidden={!error} header="Ошибка" mode="error">{error}</FormStatus>
					<Input type = "text" onChange={(e) => {setUserLink(e.target.value);}}/>
					<Button stretched size = "xl" onClick={getUserInfo}>Загрузить</Button>
					{fetchedUser &&
					<Group>
						<Cell style={{marginLeft:12}}
							before={fetchedUser.photo_200 ? <Avatar src={fetchedUser.photo_200}/> : null}
							description={fetchedUser.city && fetchedUser.city.title ? fetchedUser.city.title : ''}>
							{`${fetchedUser.first_name} ${fetchedUser.last_name}`}
						</Cell>
					</Group>}
				</FormLayout>

				<Progress value={progress} />

				<Group>
					<List>
						{items.map((item) => <Cell key={item.value[0]}>[{item.value[1].friends}] {item.value[1].name} </Cell>)}
					</List>
				</Group>
			</Panel>)
	}
};

Home.propTypes = {
	id: PropTypes.string.isRequired,
	go: PropTypes.func.isRequired,
	fetchedUser: PropTypes.shape({
		photo_200: PropTypes.string,
		first_name: PropTypes.string,
		last_name: PropTypes.string,
		city: PropTypes.shape({
			title: PropTypes.string,
		}),
	}),
};

export default Home;
