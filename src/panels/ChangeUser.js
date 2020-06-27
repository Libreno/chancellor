import React from 'react';
import { Panel } from '@vkontakte/vkui';

const ChangeUser = (id, go) => {
    return (
        <Panel id={id}>
    		<Button style={{marginRight: 8}}>Я</Button>
			{/* <Group hidden={} ><Button onClick={getFriends}>Выбор</Button></Group> */}
			{IS_MVK? '' : <Button onClick={getFriends}>Выбор из друзей</Button>}
			<Input type = "text" onChange={(e) => {setUserLink(e.target.value);}}/><Button onClick={getUserByLink(userLink)}>Загрузить</Button>
        </Panel>);
};

export default ChangeUser;