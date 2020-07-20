import React, { useState, useEffect } from 'react';
import View from '@vkontakte/vkui/dist/components/View/View';
import ScreenSpinner from '@vkontakte/vkui/dist/components/ScreenSpinner/ScreenSpinner';
import '@vkontakte/vkui/dist/vkui.css';
import VKDataService from "./services/VKDataService"
import bridge from "@vkontakte/vk-bridge";

import Home from './panels/Home';

const App = () => {
	const [activePanel, setActivePanel] = useState('home');
	const [fetchedUser, setUser] = useState(null);
	const [popout, setPopout] = useState(<ScreenSpinner size='large' />);
	const [progress, setProgress] = useState(0);
	const [items, setItems] = useState([]);
	const pageSize = 10;
	const [topCount, setTopCount] = useState(pageSize);
	const [topHasMore, setHasMore] = useState(false);
	const [groupsDataMap, setGroupsDataMap] = useState(new Map());
	const [friendsRequestsDataMap, setFriendsRequestsDataMap] = useState(new Map());
	const [topDataKeysSet, setTopDataKeysSet] = useState(new Set());
	const [topDataArr, setTopDataArr] = useState([]);

	const start = (userId) => {
		VKDataService.GetGroupsData(userId, setProgress, setItems, setHasMore, topCount, groupsDataMap, friendsRequestsDataMap, topDataKeysSet, topDataArr);
	};

	useEffect(() => {
		bridge.subscribe(({ detail: { type, data }}) => {
			if (type === 'VKWebAppUpdateConfig') {
				const schemeAttribute = document.createAttribute('scheme');
				schemeAttribute.value = data.scheme ? data.scheme : 'client_light';
				document.body.attributes.setNamedItem(schemeAttribute);
			}
		});
		VKDataService.GetCurrentUserInfo().then((user) => {
			setUser(user);
			start(user.id);
			setPopout(null);
			});
	}, [topCount, topDataArr, topDataKeysSet, groupsDataMap, friendsRequestsDataMap]);

	return (
		<View activePanel={activePanel} popout={popout}>
			<Home id='home' 
				fetchedUser={fetchedUser} 
				progress={progress} 
				items={items} 
				loadUser={(user) => {
					setUser(user); 
					setGroupsDataMap(new Map());
					start();}} 
				incTopCount = {() => {
					setTopCount(Number(topCount) + Number(pageSize))
				}} 
				hasMore = {topHasMore}/>
		</View>
	);
}

export default App;
