import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Panel from '@vkontakte/vkui/dist/components/Panel/Panel';
import PanelHeader from '@vkontakte/vkui/dist/components/PanelHeader/PanelHeader';
import Progress from "@vkontakte/vkui/dist/components/Progress/Progress";
import Button from '@vkontakte/vkui/dist/components/Button/Button';
import Group from '@vkontakte/vkui/dist/components/Group/Group';
import Cell from '@vkontakte/vkui/dist/components/Cell/Cell';
import Div from '@vkontakte/vkui/dist/components/Div/Div';
import Avatar from '@vkontakte/vkui/dist/components/Avatar/Avatar';
import Input from '@vkontakte/vkui/dist/components/Input/Input';
import { List } from '@vkontakte/vkui';
import bridge from "@vkontakte/vk-bridge";
import VKDataService from "../services/VKDataService";

const Home = ({ id, go, fetchedUser, progress, items, setUser }) => {
	const IS_MVK = window.location.href.indexOf('vk_platform=mobile_web') !== -1;
	const [userLink, setUserLink] = useState("");

	const getFriends = () => {
		bridge.send("VKWebAppGetFriends", {}).then((val) => {
			setUser(val.users[0]);
		});
	};

	const getUserByLink = (link) => {
		// todo: validation
		let segments = link.split('/');
		let userName = segments[segments.length - 1];
		// const user = VKDataService.GetCurrentUserInfo();
		console.log(link);
		console.log(userName);
		VKDataService.GetUserInfo(userName);
	};

	return (<Panel id={id}>
		{/* <PanelHeader>Канцлер</PanelHeader> */}
		{fetchedUser &&
		<Group>
			<Cell
				before={fetchedUser.photo_200 ? <Avatar src={fetchedUser.photo_200}/> : null}
				asideContent={
					<Group>
						<Button style={{marginRight: 8}}>Я</Button>
						{/* <Group hidden={} ><Button onClick={getFriends}>Выбор</Button></Group> */}
						{IS_MVK? '' : <Button onClick={getFriends}>Выбор из друзей</Button>}
						<Input type = "text" onChange={(e) => {setUserLink(e.target.value);}}/><Button onClick={getUserByLink(userLink)}>Загрузить</Button>
					</Group>}
				description={fetchedUser.city && fetchedUser.city.title ? fetchedUser.city.title : ''}				
			>
				{`${fetchedUser.first_name} ${fetchedUser.last_name}`}
			</Cell>
		</Group>}

		<Progress value={progress} />

		<Group>
			<List>
				{items.map((item) => <Cell key={item.value[0]}>[{item.value[1].friends}] {item.value[1].name} </Cell>)}
			</List>
		</Group>

		<Group title="Navigation Example" hidden={true}>
			<Div>
				<Button size="xl" level="2" onClick={go} data-to="persik">
					Show me the Persik, please
				</Button>
			</Div>
		</Group>
	</Panel>)
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
