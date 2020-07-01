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

	const start = (w) => {
		VKDataService.GetGroupsData(fetchedUser.id, setProgress, setItems);
	};

	useEffect(() => {
		bridge.subscribe(({ detail: { type, data }}) => {
			if (type === 'VKWebAppUpdateConfig') {
				const schemeAttribute = document.createAttribute('scheme');
				schemeAttribute.value = data.scheme ? data.scheme : 'client_light';
				document.body.attributes.setNamedItem(schemeAttribute);
			}
		});
		async function fetchData() {
			const user = await VKDataService.GetCurrentUserInfo();
			setUser(user);
			// start();
			VKDataService.GetGroupsData(user.id, setProgress, setItems);
			setPopout(null);
		}
		fetchData();
	}, []);

	const go = e => {
		setActivePanel(e.currentTarget.dataset.to);
	};

	return (
		<View activePanel={activePanel} popout={popout}>
			<Home id='home' fetchedUser={fetchedUser} go={go} progress={progress} items={items} setUser={(user) => {setUser(user); start();}} />
		</View>
	);
}

export default App;

