import React from 'react';
import Panel from '@vkontakte/vkui/dist/components/Panel/Panel';
import Button from '@vkontakte/vkui/dist/components/Button/Button';
import '../styles/style.css'
import { PanelHeader } from '@vkontakte/vkui';

const StartScreen = ({id, go}: any) => {
    return (
        <Panel id={id}>
            <PanelHeader>Мои друзья и их сообщества</PanelHeader>
            <div id='allfriends-start-screen'>
                <div className="paragraph">1. Приложение выводит список групп, в которых состоят Ваши друзья.</div>
                <div className="paragraph">2. Можно анализировать профиль любого пользователя, чьи данные Вам доступны.</div>
                <div className="paragraph">3. Список будет отсортирован в порядке убывания числа друзей в группах.</div>
                <div className="paragraph">
                    4. Каждая строка имеет вид:</div>
                    <div>
                        <div className="paragraph" id="allfriends-groups-list">
                            <div className='allfriends-vk-group-card'>
                                <div className='group-name'>[N]&nbsp;"Название группы"</div>
                                <div className='group-id'>ИД группы</div>
                            </div>
                        </div>
                        <div className="paragraph">Где N - количество друзей в данной группе.</div>
                    </div>
                <div className="paragraph">4. Часто друзей бывает сотни и тысячи, поэтому получение данных занимает 
                продолжительное время и в процессе работы выводится только часть промежуточных результатов, 
                которая может быть увеличена нажатием на кнопу "Показать ещё" и последующим свайпом вниз.</div>
                <div className="paragraph">При большом количестве друзей (больше 1000) увеличение количества отображаемых промежуточных результатов 
                может заметно отразиться на общем времени получения данных (~ +10% к времени работы).</div>
                <div className="paragraph">5. Никакие персональные данные с Вашего устройства приложением никуда не отправляются и нигде не сохраняются.</div>
            </div>
            <Button stretched size = "xl" onClick={go}>Показать</Button>
        </Panel>)
}

export default StartScreen;
