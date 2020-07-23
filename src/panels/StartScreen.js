import React from 'react';
import Panel from '@vkontakte/vkui/dist/components/Panel/Panel';
import Button from '@vkontakte/vkui/dist/components/Button/Button';

const StartScreen = ({id, go}) => {
    return (
        <Panel id={id}>
            <div>Описание приложения с картинками.</div>
            <Button onClick={go}>Начать</Button>
        </Panel>)
}

export default StartScreen;
