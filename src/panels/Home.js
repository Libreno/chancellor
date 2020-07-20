import React, {useState} from 'react';
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
import Avatar from '@vkontakte/vkui/dist/components/Avatar/Avatar';
import { List } from '@vkontakte/vkui';
import VKDataService from "../services/VKDataService";
import InfiniteScroll from 'react-infinite-scroll-component';

const Home = ({ id, fetchedUser, progress, items, loadUser, incTopCount, hasMore }) => {
	const loadUserClick = () => {
		if (userLink === ""){
			return;
		};
		let segments = userLink.split('/');
		let userName = segments[segments.length - 1];
		VKDataService.GetUserInfo(userName).then((userData) => {
			loadUser(userData.response[0]);
		}).catch((errorResponse) => {
			setError(errorResponse.error_data.error_reason.error_msg);
		});
	};

	const [error, setError] = useState(null);
	const [userLink, setUserLink] = useState('');

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

			<Progress value={progress} />

			<Group>
				<List>
					<InfiniteScroll
						dataLength={items.length}
						next={incTopCount}
						hasMore={hasMore}
						loader={<h4>Loading...</h4>}
						>
						{items.map((item) => <Cell key={item.value[0]} indicator={item.value[0]}>[{item.value[1].friends}] {item.value[1].name}</Cell>)}
					</InfiniteScroll>
				</List>
			</Group>
		</Panel>)
};

Home.propTypes = {
	id: PropTypes.string.isRequired,
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
